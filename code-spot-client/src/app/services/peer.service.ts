import { EventEmitter, Injectable } from '@angular/core';
import { Message, MessageType } from '../shared/Message';
import { RoomService } from './room.service';
import { CRDT } from '../shared/CRDT';
import { EditorService } from './editor.service';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';
import { CrdtUtils, PeerUtils, Utils } from '../shared/Utils';
import { CursorChangeInfo } from '../shared/CursorChangeInfo';
import { SelectionChangeInfo } from '../shared/SelectionChangeInfo';
import { CursorService } from './cursor.service';
import { PeerServerConnection } from '../shared/PeerServerConnection';
import { PeersConnection } from '../shared/PeersConnection';
import { BroadcastInfo } from '../shared/BroadcastInfo';
import { NameService } from './name.service';
import { AlertifyService } from './alertify.service';
import { NameColor } from '../shared/NameColor';

declare const Peer: any;
const BROADCAST_TILL_MILLI_SECONDS_LATER = 15000;
@Injectable({
  providedIn: 'root',
})
export class PeerService {
  private packageId = 0;
  private peer: any;
  private roomName: string;
  private connToGetOldMessages: any;
  private peerIdsToSendOldCrdts: string[] = [];
  private peerIdsToSendOldChatMessages: string[] = [];
  private peerIdsInRoomWhenFirstEnter: any[] = [];
  private connectionsIAmHolding: any[] = [];
  private hasReceivedAllOldCRDTs = false;
  private connsToBroadcast: any[] = [];
  private readonly CRDTDelimiter = '#$'; // Has to be at least 2 unique chars
  connectionEstablished = new EventEmitter<boolean>();
  private receivedRemoteCrdts: CRDT[];
  private cursorChangeInfo: CursorChangeInfo;
  private selectionChangeInfo: SelectionChangeInfo;
  private previousChatMessages: Message[] = [];
  private hasReceivedAllChatMessages: boolean = false;
  private peerIdJustLeft: string;
  private nameColorList: NameColor[] = [];

  constructor(
    private roomService: RoomService,
    private cursorService: CursorService,
    private editorService: EditorService,
    private nameService: NameService,
    private alertifyService: AlertifyService
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
    this.peer.on(PeerServerConnection.Open, (myId: string) => {
      console.log('I have connected to peerServer. My id: ' + myId);
      this.connectionEstablished.emit(true);
    });
  }

  private reconnectToPeerServer() {
    this.peer.on(PeerServerConnection.Disconnected, () => {
      // Disconnect => destroy permanently this peer. Need to test this more!
      console.log(
        'Peer disconnect with server. Destroying peer ... (Although we should try to reconnect here)'
      );
      this.peer.destroy();

      PeerUtils.handlePeerError(
        'Wifi connection error! Going back to Home page?'
      );
    });
  }

  private logErrors() {
    this.peer.on(PeerServerConnection.Error, (error) => {
      console.error('PeerServer error: ');
      console.error(error);
    });
  }
  //*************************************************************

  private listenToBrowserOffline() {
    // Need a better way to check internet connection! This method is error prone
    window.addEventListener('offline', (e) => {
      PeerUtils.handlePeerError(
        'Please check your Internet connection. Going back to Home page?'
      );
    });
  }

  private registerConnectToMeEvent() {
    this.peer.on(PeerServerConnection.Connection, (conn: any) => {
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
    this.peerIdsInRoomWhenFirstEnter.forEach((peerId) => {
      if (peerId !== exceptPeerId) this.connectToPeer(peerId, false);
    });
  }

  private setupListenerForConnection(conn: any) {
    // When the connection first establish
    conn.on(PeersConnection.Open, () => {
      // Order is important! Name first and then cursor info!
      this.sendMyName(conn);

      this.sendCursorInfo(conn);

      // Seems weird but we need it
      this.cursorService.peerIdsNeverSendCursorTo.add(conn.peer);

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

      // If we just join room (this peer is here before us) and are ready (have received all CRDTs)
      if (
        this.peerIdsInRoomWhenFirstEnter.find((id) => id === conn.peer) &&
        this.hasReceivedAllOldCRDTs
      ) {
        conn.send(
          new Message(null, MessageType.CanDisplayMeJustJoinRoom, this.peer.id)
        );
      }
    });

    /**
     * Subscribe to receive messages from other peers
     */
    conn.on(PeersConnection.Data, (message: Message) =>
      this.handleMessageFromPeer(message, conn)
    );

    /**
     * Event is raised when either us or other peers close the connection
     */
    conn.on(PeersConnection.Close, () => this.handleConnectionClose(conn));

    conn.on(PeersConnection.Error, (error: any) => {
      console.error('Connection error: ');
      console.error(error);
    });
  }

  private handleMessageFromPeer(message: Message, fromConn: any) {
    switch (message.messageType) {
      case MessageType.ChangeLanguage:
        EditorService.language = message.content;
        PeerUtils.broadcastInfo(BroadcastInfo.ChangeLanguage);

        // Tell user language has been changed
        this.alertifyService.message(
          'Language has been changed to ' + message.content
        );
        break;
      case MessageType.RemoteInsert:
      case MessageType.RemoteRemove:
        this.broadcastMessageToNewPeers(message, this.connsToBroadcast);
      case MessageType.OldCRDTs:
      case MessageType.OldCRDTsLastBatch:
        const parsedCrdts: CRDT[] = JSON.parse(message.content); // plain Javascript object
        const crdts = parsedCrdts.map((crdt) =>
          CRDT.plainObjectToRealCRDT(crdt)
        );
        this.receivedRemoteCrdts = crdts;

        if (message.messageType === MessageType.RemoteInsert) {
          PeerUtils.broadcastInfo(BroadcastInfo.RemoteInsert);
        } else if (message.messageType === MessageType.RemoteRemove) {
          PeerUtils.broadcastInfo(BroadcastInfo.RemoteRemove);
        } else {
          PeerUtils.broadcastInfo(BroadcastInfo.RemoteAllMessages);
          if (message.messageType === MessageType.OldCRDTsLastBatch) {
            this.hasReceivedAllOldCRDTs = true;
            PeerUtils.broadcastInfo(BroadcastInfo.ReadyToDisplayMonaco);
            this.connectToTheRestInRoom(this.connToGetOldMessages.peer);
            // Tell C# Server I have received AllMessages
            this.roomService.markPeerReceivedAllMessages(this.peer.id);
            // Send cursor + selection change info
            this.sendCursorInfo(fromConn);
            // Tell that user they can display us just join room now
            fromConn.send(
              new Message(
                null,
                MessageType.CanDisplayMeJustJoinRoom,
                this.peer.id
              )
            );
          }
        }
        break;
      case MessageType.RequestOldCRDTs:
        if (!this.hasReceivedAllOldCRDTs) {
          console.log(
            "I haven't received allMessages yet. Can't send to that peer"
          );
          fromConn.send(
            new Message(null, MessageType.CannotSendOldCRDTs, this.peer.id)
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
        this.broadcastMessageToNewPeers(message, this.connsToBroadcast);
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
              this.peer.id
            )
          );
        } else {
          if (
            !PeerUtils.connectionHasOpened(fromConn, this.connectionsIAmHolding)
          ) {
            this.peerIdsToSendOldChatMessages.push(fromConn.peer); // Send when opened
          } else {
            this.sendOldMessages(fromConn); // send now
          }
        }
        break;
      case MessageType.ChangeCursor:
        const cursorEvent = JSON.parse(message.content);
        this.cursorChangeInfo = new CursorChangeInfo(
          cursorEvent.position.lineNumber,
          cursorEvent.position.column,
          fromConn.peer
        );
        PeerUtils.broadcastInfo(BroadcastInfo.CursorChange);
        break;
      case MessageType.ChangeSelect:
        const selectEvent = JSON.parse(message.content);
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
        this.cursorService.setPeerColor(fromConn.peer, color);
        if (this.nameService.getPeerName(fromConn.peer)) {
          // Have name and color => Add to list
          Utils.addUniqueNameColor(
            new NameColor(
              this.nameService.getPeerName(fromConn.peer),
              this.cursorService.getPeerColor(fromConn.peer),
              fromConn.peer
            ),
            this.nameColorList
          );
        }
        break;
      case MessageType.Name:
        const peerName = message.content;
        this.nameService.setPeerName(fromConn.peer, peerName);
        if (this.cursorService.getPeerColor(fromConn.peer)) {
          // Have name and color => Add to list
          Utils.addUniqueNameColor(
            new NameColor(
              this.nameService.getPeerName(fromConn.peer),
              this.cursorService.getPeerColor(fromConn.peer),
              fromConn.peer
            ),
            this.nameColorList
          );
        }
        break;
      case MessageType.CanDisplayMeJustJoinRoom:
        PeerUtils.broadcastInfo(BroadcastInfo.NewPeerJoining);
        this.alertifyService.success(
          this.nameService.getPeerName(fromConn.peer) + ' just joined room'
        );
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

    // Delete peer's cursor, select,...
    this.peerIdJustLeft = conn.peer;

    // Delete peer's nameColor
    this.nameColorList = this.nameColorList.filter(
      (x) => x.ofPeerId !== conn.peer
    );

    // IMPORTANT: Must be after delete peer's name color out of the list
    PeerUtils.broadcastInfo(BroadcastInfo.PeerLeft);

    // Tell user that peer just left room
    const name = this.nameService.getPeerName(conn.peer);
    this.alertifyService.warning(name + ' just left');
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
      this.cursorService.setPeerColor(peerIds[i], cursorColors[i]);
    }
    this.cursorService.setMyCursorColorAndPeerId(this.peer.id, cursorColor);

    this.nameService.giveMyselfRandomName(this.peer.id);

    this.nameColorList.push(
      new NameColor(
        this.nameService.getPeerName(this.peer.id),
        this.cursorService.getPeerColor(this.peer.id),
        this.peer.id
      )
    );

    PeerUtils.broadcastInfo(BroadcastInfo.NewPeerJoining);

    if (peerIds.length === 0) {
      // DO NOTHING
      console.log('I am the first one in this room');
      this.hasReceivedAllOldCRDTs = true;
      this.hasReceivedAllChatMessages = true;
    } else {
      this.peerIdsInRoomWhenFirstEnter = peerIds;
      const peerIdPicked = this.pickReadyPeerToGetAllMessages(
        peerIds,
        receivedAllMessages
      );
      if (peerIdPicked === null) {
        PeerUtils.handlePeerError(
          'All people have left the room. Going back to Home page?'
        );
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
    if (!this.hasReceivedAllOldCRDTs) {
      this.roomService.getPeerIdsInRoom(this.roomName).subscribe((peerIds) => {
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
    const message = new Message(null, messageType, this.peer.id);
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
        this.packageId++,
        i,
        numberOfTimesSend
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
      this.peer.id
    );
    conn.send(message);
  }

  private sendMyCursorColor(conn: any, myColor: number) {
    conn.send(new Message(myColor + '', MessageType.CursorColor, this.peer.id));
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
          PeerUtils.handlePeerError(
            'Room not exists! Going back to Home page?'
          );
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
          this.packageId++,
          i,
          numberOfTimesSend
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

  private broadcastMessageToNewPeers(message: Message, conns: any[]) {
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
      this.peer.id
    );
    conn.send(messageToSend);
  }

  sendMessage(content: string) {
    if (content.length === 0) {
      return;
    }

    this.previousChatMessages.push(
      new Message(content, MessageType.ChatMessage, this.peer.id, this.packageId)
    );

    this.connectionsIAmHolding.forEach((conn) => {
      const messageToSend = new Message(
        content,
        MessageType.ChatMessage,
        this.peer.id,
        this.packageId
      );

      conn.send(messageToSend);
    });
    this.packageId++;
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
      this.peer.id
    );
    conn.send(message);
  }

  broadcastChangeCursorPos(event: any): void {
    this.connectionsIAmHolding.forEach((conn) => {
      this.sendChangeCursorPos(conn, event);
    });
  }

  sendChangeCursorPos(conn: any, event: any): void {
    const message = new Message(
      JSON.stringify(event),
      MessageType.ChangeCursor,
      this.peer.id
    );
    conn.send(message);
  }

  sendCursorInfo(conn: any): void {
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

  sendMyName(conn: any): void {
    const message = new Message(
      this.nameService.getMyName(),
      MessageType.Name,
      this.peer.id
    );
    conn.send(message);
  }

  getPeerIdJustLeft(): string {
    return this.peerIdJustLeft;
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
    const peerIdsInRoom = this.connectionsIAmHolding.map((conn) => conn.peer);
    if (this.peer) {
      peerIdsInRoom.push(this.peer.id);
    }
    return peerIdsInRoom;
  }

  getNameColorList(): NameColor[] {
    return this.nameColorList;
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
