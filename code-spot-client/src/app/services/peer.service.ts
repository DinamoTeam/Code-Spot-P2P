import { EventEmitter, Injectable } from '@angular/core';
import { Message, MessageType } from '../shared/Message';
import { RoomService } from './room.service';
import { CRDT } from '../shared/CRDT';
import { EditorService } from './editor.service';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';
import { PeerEvent } from '../shared/PeerEvent';
import { CrdtUtils, PeerUtils, Utils } from '../shared/Utils';
import { BroadcastInfo } from '../shared/BroadcastInfo';
import { CursorChangeInfo } from '../shared/CursorChangeInfo';
import { SelectionChangeInfo } from '../shared/SelectionChangeInfo';
import { CursorService } from './cursor.service';

declare const Peer: any;
const BROADCAST_TILL_MILLI_SECONDS_LATER = 15000;
@Injectable({
  providedIn: 'root',
})
export class PeerService {
  private time = 0;
  private peer: any;
  private roomName: string;
  private connToGetOldMessages: any;
  private peerIdsToSendOldCrdts: string[] = [];
  private peerIdsToSendOldChatMessages: string[] = [];
  private peerIdsInRoom: any[] = [];
  private connectionsIAmHolding: any[] = [];
  private hasReceivedAllMessages = false;
  private connsToBroadcast: any[] = [];
  private readonly CRDTDelimiter = '#$'; // Has to be at least 2 unique chars
  connectionEstablished = new EventEmitter<boolean>();
  private receivedRemoteCrdts: CRDT[];
  private cursorChangeInfo: CursorChangeInfo;
  private selectionChangeInfo: SelectionChangeInfo;
  private previousChatMessages: Message[] = [];
  private hasReceivedAllChatMessages: boolean = false;

  constructor(
    private roomService: RoomService,
    private cursorService: CursorService,
    private editorService: EditorService
  ) {}

  connectToPeerServerAndInit() {
    this.peer = new Peer({
      host: 'codespotpeerserver.herokuapp.com/',
      port: '/..',
      secure: true,
      config: {
        iceServers: [
          { url: 'stun:relay.backups.cz' },
          {
            url: 'turn:relay.backups.cz',
            username: 'webrtc',
            credential: 'webrtc',
          },
        ],
      },
      pingInterval: 3000,
      // debug: 3, // Print all logs
    });
    /*this.peer = new Peer({
      host: 'localhost',
      port: 9000,
      path: '/myapp',
    });*/
    this.connectToPeerServer();
    this.registerConnectToMeEvent();
    this.logErrors();
    this.reconnectToPeerServer();
    this.subscribeToEditorServiceEvents();
    this.listenToBrowserOffline();
  }

  //************* Connect + Reconnect to PeerServer and log errors *************
  private connectToPeerServer() {
    this.peer.on(PeerEvent.Open, (myId: string) => {
      console.log('I have connected to peerServer. My id: ' + myId);
      this.connectionEstablished.emit(true);
    });
  }

  private reconnectToPeerServer() {
    this.peer.on(PeerEvent.Disconnected, () => {
      // Disconnect => destroy permanently this peer. Need to test this more!
      console.log(
        'Peer disconnect with server. Destroying peer ... (Although we should try to reconnect here)'
      );
      this.peer.destroy();
      alert('Wifi connection error! Going back home...');
      Utils.refreshAndGoBackHomePage();
    });
  }

  private logErrors() {
    this.peer.on(PeerEvent.Error, (error) => {
      console.error('PeerServer error: ');
      console.error(error);
    });
  }
  //*************************************************************

  private listenToBrowserOffline() {
    // Need a better way to check internet connection! This method is error prone
    window.addEventListener('offline', (e) => {
      alert('Please check your Internet connection. Navigating back home...');
      Utils.refreshAndGoBackHomePage();
    });
  }

  private registerConnectToMeEvent() {
    this.peer.on(PeerEvent.Connection, (conn: any) => {
      console.log('Peer ' + conn.peer + ' just sent a connect request to me');
      this.setupListenerForConnection(conn);
    });
  }

  private connectToPeer(otherPeerId: any, getOldMessages: boolean) {
    const conn = this.peer.connect(otherPeerId, {
      reliable: true,
      serialization: 'json',
    });

    if (getOldMessages === true) this.connToGetOldMessages = conn;

    console.log('I just send peer: ' + otherPeerId + ' a connection request');
    this.setupListenerForConnection(conn);
  }

  private connectToTheRestInRoom(exceptPeerId: any) {
    this.peerIdsInRoom.forEach((peerId) => {
      if (peerId !== exceptPeerId) this.connectToPeer(peerId, false);
    });
  }

  private setupListenerForConnection(conn: any) {
    // When the connection first establish
    conn.on(PeerEvent.Open, () => {
      // Send our cursor's info
      this.sendCursorInfo(conn);
      console.log('Connection to peer ' + conn.peer + ' opened :)');
      // Only add this conn to our list when the connection has opened!
      Utils.addUniqueConnections([conn], this.connectionsIAmHolding);
      // If we need to send this peer old messages
      if (
        this.peerIdsToSendOldCrdts.findIndex((id) => id === conn.peer) !== -1
      ) {
        this.broadcastNewMessagesToConnUntil(
          conn,
          BROADCAST_TILL_MILLI_SECONDS_LATER
        );
        this.sendOldCRDTs(conn);
        this.sendOldMessages(conn);
        this.peerIdsToSendOldCrdts.filter((id) => id !== conn.peer);
        this.sendChangeLanguage(conn);
      }
      // If we chose this peer to give us all messages
      if (this.connToGetOldMessages === conn) {
        this.requestOldMessages(conn, MessageType.RequestOldCRDTs);
        this.requestOldMessages(conn, MessageType.RequestOldChatMessages);
      }
    });

    /**
     * Subscribe to receive messages from other peers
     */
    conn.on(PeerEvent.Data, (message: Message) =>
      this.handleMessageFromPeer(message, conn)
    );

    /**
     * Event is raised when either us or other peers close the connection
     */
    conn.on(PeerEvent.Close, () => this.handleConnectionClose(conn));

    conn.on(PeerEvent.Error, (error: any) => {
      console.error('Connection error: ');
      console.error(error);
    });
  }

  private handleMessageFromPeer(message: Message, fromConn: any) {
    switch (message.messageType) {
      case MessageType.ChangeLanguage:
        this.broadcastMessageToPeers(message, this.connsToBroadcast);
        EditorService.language = message.content;
        PeerUtils.broadcastInfo(BroadcastInfo.ChangeLanguage);
        break;
      case MessageType.RemoteInsert:
      case MessageType.RemoteRemove:
        this.broadcastMessageToPeers(message, this.connsToBroadcast);
      case MessageType.OldCRDTs:
      case MessageType.OldCRDTsLastBatch:
        const parsedCrdts: CRDT[] = JSON.parse(message.content); // plain Javascript object
        const crdts = parsedCrdts.map((crdt) =>
          CRDT.plainObjectToRealCRDT(crdt)
        );
        this.receivedRemoteCrdts = crdts;

        if (message.messageType === MessageType.RemoteInsert) {
          console.log('Receive Remote Insert');
          // peerMessagesTracker.receiveRemoteInserts(crdts);
          PeerUtils.broadcastInfo(BroadcastInfo.RemoteInsert);
          // peerMessagesTracker.processDeleteBuffer();
        } else if (message.messageType === MessageType.RemoteRemove) {
          console.log('Receive Remote Remove');
          // peerMessagesTracker.receiveRemoteRemoves(crdts);
          PeerUtils.broadcastInfo(BroadcastInfo.RemoteRemove);
        } else {
          console.log('Receive OldCRDTs');
          // peerMessagesTracker.receiveRemoteInserts(crdts);
          PeerUtils.broadcastInfo(BroadcastInfo.RemoteAllMessages);
          if (message.messageType === MessageType.OldCRDTsLastBatch) {
            this.hasReceivedAllMessages = true;
            PeerUtils.broadcastInfo(BroadcastInfo.ReadyToDisplayMonaco);
            this.connectToTheRestInRoom(this.connToGetOldMessages.peer);
            // Tell C# Server I have received AllMessages
            this.roomService.markPeerReceivedAllMessages(this.peer.id);
            console.log('I have received LAST BATCH Old CRDTs');
            this.cursorService.setMyLastSelectEvent(null);
            this.sendCursorInfo(fromConn);
          }
        }
        break;
      case MessageType.RequestOldCRDTs:
        if (!this.hasReceivedAllMessages) {
          console.log(
            "I haven't received allMessages yet. Can't send to that peer"
          );
          fromConn.send(
            new Message(null, MessageType.CannotSendOldCRDTs, null, null, -1)
          );
        } else {
          if (
            !PeerUtils.connectionHasOpened(fromConn, this.connectionsIAmHolding)
          ) {
            this.peerIdsToSendOldCrdts.push(fromConn.peer); // Send when opened
          } else {
            this.broadcastNewMessagesToConnUntil(
              fromConn,
              BROADCAST_TILL_MILLI_SECONDS_LATER
            );
            this.sendOldCRDTs(fromConn); // send now
            this.sendChangeLanguage(fromConn);
          }
        }
        break;
      case MessageType.CannotSendOldCRDTs:
        alert(
          'The peer we picked to send us old messages cannot send. Reloading...'
        );
        window.location.reload(true);
        break;
      case MessageType.ChatMessage:
        PeerUtils.addUniqueMessages([message], this.previousChatMessages);
        PeerUtils.broadcastInfo(BroadcastInfo.UpdateChatMessages);
        break;
      case MessageType.OldChatMessages:
        this.hasReceivedAllChatMessages = true;
        const messages: Message[] = JSON.parse(message.content);
        PeerUtils.addUniqueMessages(messages, this.previousChatMessages);
        PeerUtils.broadcastInfo(BroadcastInfo.UpdateChatMessages);
        break;
      case MessageType.RequestOldChatMessages:
        if (!this.hasReceivedAllChatMessages) {
          console.log(
            "I haven't received all chat messages yet. Can't send to that peer"
          );
          fromConn.send(
            new Message(
              null,
              MessageType.CannotSendOldChatMessages,
              null,
              null,
              -1
            )
          );
        } else {
          if (
            !PeerUtils.connectionHasOpened(fromConn, this.connectionsIAmHolding)
          ) {
            this.peerIdsToSendOldChatMessages.push(fromConn.peer); // Send when opened
          } else {
            this.broadcastNewMessagesToConnUntil(
              fromConn,
              BROADCAST_TILL_MILLI_SECONDS_LATER
            );
            this.sendOldMessages(fromConn); // send now
          }
        }
        break;
      case MessageType.ChangeCursor:
        const cursorEvent = JSON.parse(message.content);
        console.log('Receive Cursor Change');
        console.log(cursorEvent);
        this.cursorChangeInfo = new CursorChangeInfo(
          cursorEvent.position.lineNumber,
          cursorEvent.position.column,
          fromConn.peer
        );
        PeerUtils.broadcastInfo(BroadcastInfo.CursorChange);
        break;
      case MessageType.ChangeSelect:
        const selectEvent = JSON.parse(message.content);
        console.log('Receive Select Change');
        console.log(selectEvent);
        this.selectionChangeInfo = new SelectionChangeInfo(
          selectEvent.selection.startLineNumber,
          selectEvent.selection.startColumn,
          selectEvent.selection.endLineNumber,
          selectEvent.selection.endColumn,
          fromConn.peer
        );
        PeerUtils.broadcastInfo(BroadcastInfo.SelectionChange);
        break;
      case MessageType.CursorColor:
        const color = Number.parseInt(message.content, 10);
        this.cursorService.addPeerColor(fromConn.peer, color);
        break;
      default:
        console.log(message);
        throw new Error('Unhandled messageType');
    }
  }

  private handleConnectionClose(conn: any) {
    console.log(
      'Connection to ' +
        conn.peer +
        ' is closed. It will be deleted in the connectionsIAmHolding list!'
    );

    const index = this.connectionsIAmHolding.findIndex(
      (connection) => connection === conn
    );
    this.connectionsIAmHolding.splice(index, 1);
  }

  //***************** Handle when join room *******************
  private handleFirstJoinRoom(
    peerIds: any[],
    receivedAllMessages: boolean[],
    cursorColors: number[],
    cursorColor: number
  ) {
    // Set cursor colors
    for (let i = 0; i < peerIds.length; i++) {
      this.cursorService.addPeerColor(peerIds[i], cursorColors[i]);
    }
    this.cursorService.setMyCursorColor(cursorColor);

    if (peerIds.length === 0) {
      // DO NOTHING
      console.log('I am the first one in this room');
      this.hasReceivedAllMessages = true;
      this.hasReceivedAllChatMessages = true;
    } else {
      this.peerIdsInRoom = peerIds;
      const peerIdPicked = this.pickReadyPeerToGetAllMessages(
        peerIds,
        receivedAllMessages
      );
      if (peerIdPicked === null) {
        alert('All Peer in rooms have left. Going back to home...');
        Utils.refreshAndGoBackHomePage();
      } else {
        this.connectToPeer(peerIdPicked, true);
        this.waitTillGotAllMessagesOrRefreshIfThatPeerLeft(peerIdPicked);
      }
    }
  }

  private pickReadyPeerToGetAllMessages(
    peerIds: string[],
    receivedAllMessages: boolean[]
  ): string {
    const candidatePeerIds = [];
    for (let i = 0; i < receivedAllMessages.length; i++) {
      if (receivedAllMessages[i]) {
        candidatePeerIds.push(peerIds[i]);
      }
    }
    if (candidatePeerIds.length === 0) {
      return null;
    } else {
      const randIndex = Math.floor(Math.random() * candidatePeerIds.length);
      return candidatePeerIds[randIndex];
    }
  }

  private waitTillGotAllMessagesOrRefreshIfThatPeerLeft(
    peerIdToGetAllMessages: string
  ) {
    if (!this.hasReceivedAllMessages) {
      this.roomService.getPeerIdsInRoom(this.roomName).subscribe((peerIds) => {
        console.log(peerIds);
        console.log(peerIdToGetAllMessages);
        if (peerIds.findIndex((id) => id === peerIdToGetAllMessages) === -1) {
          console.log(
            'The peer we intended to get old messages from just left the room. Refreshing...'
          );
          window.location.reload(true);
        } else {
          const that = this;
          setTimeout(function () {
            that.waitTillGotAllMessagesOrRefreshIfThatPeerLeft(
              peerIdToGetAllMessages
            );
          }, 3000);
        }
      });
    }
  }

  private requestOldMessages(conn: any, messageType: MessageType) {
    const message = new Message(null, messageType, null, null, this.time++);
    conn.send(message);
  }

  private sendOldCRDTs(conn: any) {
    const previousCRDTs: CRDT[] = this.editorService.getOldCRDTsAsSortedArray();

    const numberOfTimesSend = Math.ceil(
      previousCRDTs.length / CrdtUtils.MAX_CRDT_PER_SEND
    );

    const crdtBatches = CrdtUtils.breakCrdtsIntoBatches(
      previousCRDTs,
      numberOfTimesSend
    );

    for (let i = 0; i < numberOfTimesSend; i++) {
      const startInclusive = CrdtUtils.MAX_CRDT_PER_SEND * i;
      // Taking care of the case: sending the last batch
      const endExclusive = Math.min(
        CrdtUtils.MAX_CRDT_PER_SEND * (i + 1),
        previousCRDTs.length
      );
      crdtBatches.push(previousCRDTs.slice(startInclusive, endExclusive));
    }

    // const crdtStrings: string[] = [];
    // for (let i = 0; i < numberOfTimesSend; i++) {
    //   crdtStrings.push(this.crdtArrToString(crdtBatches[i], this.CRDTDelimiter));
    // }

    const crdtJSONs: string[] = [];
    for (let i = 0; i < numberOfTimesSend; i++) {
      crdtJSONs.push(JSON.stringify(crdtBatches[i]));
    }

    for (let i = 0; i < numberOfTimesSend; i++) {
      const messageType =
        i === numberOfTimesSend - 1
          ? MessageType.OldCRDTsLastBatch
          : MessageType.OldCRDTs;
      const message = new Message(
        crdtJSONs[i],
        messageType,
        this.peer.id,
        conn.peer,
        this.time++
      );
      conn.send(message);
    }

    const that = this;
    setTimeout(() => that.sendCursorInfo(conn), 10); // WHY SET TIME OUT WORKS???!!!!@@$!$!$
  }

  private sendOldMessages(conn: any) {
    const message = new Message(
      JSON.stringify(this.previousChatMessages),
      MessageType.OldChatMessages,
      this.peer.id,
      conn.peer,
      this.time++
    );
    conn.send(message);
  }

  private sendMyCursorColor(conn: any, myColor: number) {
    conn.send(
      new Message(
        myColor + '',
        MessageType.CursorColor,
        this.peer.id,
        conn.peer,
        -1
      )
    );
  }

  //*************************************************************

  createNewRoom() {
    this.roomService
      .joinNewRoom(this.peer.id)
      .subscribe((data: EnterRoomInfo) => {
        this.roomName = data.roomName;
        EditorService.setSiteId(data.siteId);
        // No peerId
        this.handleFirstJoinRoom([], [], [], data.cursorColor);
        PeerUtils.broadcastInfo(BroadcastInfo.RoomName);
        PeerUtils.broadcastInfo(BroadcastInfo.ReadyToDisplayMonaco);
      });
  }

  joinExistingRoom(roomName: string) {
    this.roomName = roomName;
    this.roomService.joinExistingRoom(this.peer.id, this.roomName).subscribe(
      (data: EnterRoomInfo) => {
        if (data.siteId === -1) {
          alert('Room not exists, navigating back to home');
          Utils.refreshAndGoBackHomePage();
        }
        EditorService.setSiteId(data.siteId);
        const boolArrHasReceivedAllMessages = data.hasReceivedAllMessages.map(
          (num) => (num === 0 ? false : true)
        );
        this.handleFirstJoinRoom(
          data.peerIds,
          boolArrHasReceivedAllMessages,
          data.cursorColors,
          data.cursorColor
        );
      },
      (error) => {
        console.error(error);
      }
    );
  }

  broadcastInsertOrRemove(crdts: CRDT[], isInsert: boolean) {
    const messageType = isInsert
      ? MessageType.RemoteInsert
      : MessageType.RemoteRemove;

    const numberOfTimesSend = Math.ceil(
      crdts.length / CrdtUtils.MAX_CRDT_PER_SEND
    );

    const crdtBatches = CrdtUtils.breakCrdtsIntoBatches(
      crdts,
      numberOfTimesSend
    );

    // const crdtStrings: string[] = [];
    // for (let i = 0; i < numberOfTimesSend; i++) {
    //   crdtStrings.push(this.crdtArrToString(crdtBatches[i], this.CRDTDelimiter));
    // }
    const crdtJSONs: string[] = [];
    for (let i = 0; i < numberOfTimesSend; i++) {
      crdtJSONs.push(JSON.stringify(crdtBatches[i]));
    }

    for (let i = 0; i < numberOfTimesSend; i++) {
      this.connectionsIAmHolding.forEach((conn) => {
        const messageToSend = new Message(
          crdtJSONs[i],
          messageType,
          this.peer.id,
          conn.peer,
          this.time++
        );
        conn.send(messageToSend);
      });
    }
  }

  private broadcastNewMessagesToConnUntil(
    conn: any,
    milliSecondsLater: number
  ) {
    this.connsToBroadcast.push(conn);
    const that = this;
    setTimeout(function () {
      that.connsToBroadcast = that.connsToBroadcast.filter(
        (connection) => connection.peer !== conn.peer
      );
    }, milliSecondsLater);
  }

  private broadcastMessageToPeers(message: Message, conns: any[]) {
    conns.forEach((connection) => {
      connection.send(message);
    });
  }

  broadcastChangeLanguage() {
    this.connectionsIAmHolding.forEach((conn) => {
      this.sendChangeLanguage(conn);
    });
  }

  sendChangeLanguage(conn: any) {
    const messageToSend = new Message(
      EditorService.language,
      MessageType.ChangeLanguage,
      this.peer.id,
      conn.peer,
      -1 // for test purpose
    );
    conn.send(messageToSend);
  }

  sendMessage(content: string) {
    if (content.length === 0) {
      return;
    }

    this.previousChatMessages.push(
      new Message(
        content,
        MessageType.ChatMessage,
        this.peer.id,
        null,
        this.time
      )
    );

    this.connectionsIAmHolding.forEach((conn) => {
      const messageToSend = new Message(
        content,
        MessageType.ChatMessage,
        this.peer.id,
        conn.peer,
        this.time
      );

      conn.send(messageToSend);
    });
    this.time++;
  }

  /* Cursor Change + Selection Change*/
  broadcastChangeSelectionPos(event: any) {
    this.connectionsIAmHolding.forEach((conn) => {
      this.sendChangeSelectionPos(conn, event);
    });
  }

  sendChangeSelectionPos(conn: any, event: any): void {
    const message = new Message(
      JSON.stringify(event),
      MessageType.ChangeSelect,
      this.peer.id,
      conn.peer,
      -1
    );
    conn.send(message);
  }

  broadcastChangeCursorPos(event: any): void {
    console.log(event);
    this.connectionsIAmHolding.forEach((conn) => {
      this.sendChangeCursorPos(conn, event);
    });
  }

  sendChangeCursorPos(conn: any, event: any): void {
    const message = new Message(
      JSON.stringify(event),
      MessageType.ChangeCursor,
      this.peer.id,
      conn.peer,
      -1
    );
    conn.send(message);
  }

  sendCursorInfo(conn: any): void {
    console.log('Sending cursor info: ');
    console.log(this.cursorService.getMyLastCursorEvent());
    console.log(this.cursorService.getMyLastSelectEvent());

    this.sendMyCursorColor(conn, this.cursorService.getMyCursorColor());
    if (this.cursorService.getMyLastCursorEvent() !== null) {
      this.sendChangeCursorPos(conn, this.cursorService.getMyLastCursorEvent());
    }
    if (this.cursorService.getMyLastSelectEvent() !== null) {
      this.sendChangeSelectionPos(
        conn,
        this.cursorService.getMyLastSelectEvent()
      );
    }
  }

  getAllMessages(): any[] {
    return this.previousChatMessages;
  }

  getSelectionChangeInfo(): SelectionChangeInfo {
    return this.selectionChangeInfo;
  }

  getCursorChangeInfo(): CursorChangeInfo {
    return this.cursorChangeInfo;
  }

  getReceivedRemoteCrdts(): CRDT[] {
    return this.receivedRemoteCrdts;
  }

  getPeerId(): string {
    return this.peer.id;
  }

  getRoomName(): string {
    return this.roomName;
  }

  getAllPeerIds(): string[] {
    return this.connectionsIAmHolding.map((conn) => conn.peer);
  }

  private subscribeToEditorServiceEvents() {
    this.editorService.crdtEvent.subscribe((insert: boolean) => {
      if (insert) {
        this.broadcastInsertOrRemove(
          this.editorService.getCrdtsToTransfer(),
          true
        );
      } else {
        this.broadcastInsertOrRemove(
          this.editorService.getCrdtsToTransfer(),
          false
        );
      }
    });
  }
}
