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
import { AlertType } from '../shared/AlertType';
import { NameService } from './name.service';
import { NameColor } from '../shared/NameColor';
import { BroadcastService } from './broadcast.service';

declare const Peer: any;
const BROADCAST_TILL_MILLI_SECONDS_LATER = 5000;
@Injectable({
  providedIn: 'root',
})
export class PeerService {
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
    private broadcastService: BroadcastService
  ) {}

  /**
   * Is called when both main and aux monaco editor are ready
   */
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

    this.broadcastService.setPeer(this.peer);
    this.listenToPeerServerEvent();
    this.registerConnectToMeEvent();
    this.subscribeToEditorServiceEvents();
    this.listenToBrowserOffline();
  }

  private listenToPeerServerEvent() {
    this.peer.on(PeerServerConnection.Open, (myId: string) => {
      console.log('I have connected to peerServer. My id: ' + myId);
      this.connectionEstablished.emit(true);
    });

    this.peer.on(PeerServerConnection.Disconnected, () => {
      // Disconnect => destroy permanently this peer
      this.peer.destroy();

      PeerUtils.handlePeerError(
        'Wifi connection error! Going back to Home page?'
      );
    });

    this.peer.on(PeerServerConnection.Error, (error) => {
      console.error(error);
    });
  }

  /**
   * What to do when a peer send me a connect request
   */
  private registerConnectToMeEvent() {
    this.peer.on(PeerServerConnection.Connection, (conn: any) => {
      this.setupListenerForConnection(conn);
    });
  }

  /**
   * A better way to determine online / offline status is to try sending a HTTP request to some servers
   * and wait for a response. For simplicity, however, we use the method below
   */
  private listenToBrowserOffline() {
    window.addEventListener('offline', (e) => {
      PeerUtils.handlePeerError(
        'Please check your Internet connection. Going back to Home page?'
      );
    });
  }

  private connectToPeer(otherPeerId: any, getOldMessages: boolean) {
    const conn = this.peer.connect(otherPeerId, {
      reliable: true,
      serialization: 'json',
    });

    if (getOldMessages === true) {
      this.connToGetOldMessages = conn;
    }

    this.setupListenerForConnection(conn);
  }

  private connectToTheRestInRoom(exceptPeerId: any) {
    this.peerIdsInRoomWhenFirstEnter.forEach((peerId) => {
      if (peerId !== exceptPeerId) {
        this.connectToPeer(peerId, false);
      }
    });
  }

  private setupListenerForConnection(conn: any) {
    /**
     * Event is raised when the connection between us and the other peer is opened.
     * Note: We can send message to that peer now and they'll receive it. BUT
     * if their connection to us hasn't opened, they cannot send message to us
     */
    conn.on(PeersConnection.Open, () => {
      this.handleConnectionOpened(conn);
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

    /**
     * Event is raised when there is an error
     */
    conn.on(PeersConnection.Error, (error: any) => {
      console.error(error);
    });
  }

  /**
   * This function is called when the connection between us and a peer is opened
   */
  private handleConnectionOpened(conn: any): void {
    // Order is important! Name first and then cursor info!
    this.broadcastService.sendMyName(conn, this.nameService.getMyName());
    this.broadcastService.sendCursorInfo(conn);

    // Seems weird but we need it
    this.cursorService.peerIdsNeverSendCursorTo.add(conn.peer);

    console.log('Connection to peer ' + conn.peer + ' opened :)');

    // Only add this connection to our list when it has been opened!
    Utils.addUniqueConnections([conn], this.connectionsIAmHolding);

    // If we need to send this peer old messages
    if (this.peerIdsToSendOldCrdts.findIndex((id) => id === conn.peer) !== -1) {
      this.broadcastService.broadcastNewMessagesToConnUntil(
        conn,
        BROADCAST_TILL_MILLI_SECONDS_LATER,
        this.connsToBroadcast
      );
      this.broadcastService.sendOldCRDTs(conn);
      this.broadcastService.sendOldMessages(conn, this.previousChatMessages);
      this.peerIdsToSendOldCrdts = this.peerIdsToSendOldCrdts.filter(
        (id) => id !== conn.peer
      );
      this.broadcastService.sendChangeLanguage(conn);
    }
    // If we chose this peer to give us all messages
    if (this.connToGetOldMessages === conn) {
      this.broadcastService.requestOldMessages(
        conn,
        MessageType.RequestOldCRDTs
      );
      this.broadcastService.requestOldMessages(
        conn,
        MessageType.RequestOldChatMessages
      );
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
  }

  /**
   * Is called when a peer send us a message
   * Note: PeerUtils.broadcastInfo() is to notify code-editor.component.ts
   */
  private handleMessageFromPeer(message: Message, fromConn: any) {
    switch (message.messageType) {
      /**
       * Handle CRDT related requests
       */

      // 4 similar requests: remote insert / remove, oldCRDTs and oldCRDTs last batch
      case MessageType.RemoteInsert:
      case MessageType.RemoteRemove:
        this.broadcastService.broadcastMessageToNewPeers(
          message,
          this.connsToBroadcast
        );
      case MessageType.OldCRDTs:
      case MessageType.OldCRDTsLastBatch:
        // message.content will be empty when the peer send oldCRDT and there are none
        if (message.content !== '') {
          const crdts = CrdtUtils.stringToCRDTArr(
            message.content,
            this.CRDTDelimiter
          );
          this.receivedRemoteCrdts = crdts;
          if (message.messageType === MessageType.RemoteInsert) {
            PeerUtils.broadcastInfo(BroadcastInfo.RemoteInsert);
          } else if (message.messageType === MessageType.RemoteRemove) {
            PeerUtils.broadcastInfo(BroadcastInfo.RemoteRemove);
          } else {
            PeerUtils.broadcastInfo(BroadcastInfo.RemoteAllMessages);
          }
        }

        if (message.messageType === MessageType.OldCRDTsLastBatch) {
          this.hasReceivedAllOldCRDTs = true;
          PeerUtils.broadcastInfo(BroadcastInfo.ReadyToDisplayMonaco);
          this.connectToTheRestInRoom(this.connToGetOldMessages.peer);
          // Tell C# Server I have received AllMessages
          this.roomService.markPeerReceivedAllMessages(this.peer.id);
          // Send cursor + selection change info
          this.broadcastService.sendCursorInfo(fromConn);
          // Tell that user they can display us just join room now
          fromConn.send(
            new Message(
              null,
              MessageType.CanDisplayMeJustJoinRoom,
              this.peer.id
            )
          );
        }
        break;

      // Somebody asks us to send them old CRDTs
      case MessageType.RequestOldCRDTs:
        if (!this.hasReceivedAllOldCRDTs) {
          console.log(
            "I haven't received allMessages yet. Can't send to that peer"
          );
          fromConn.send(
            new Message(null, MessageType.CannotSendOldCRDTs, this.peer.id)
          );
        } else {
          // Only send when connection has opened
          if (
            !PeerUtils.connectionHasOpened(fromConn, this.connectionsIAmHolding)
          ) {
            this.peerIdsToSendOldCrdts.push(fromConn.peer); // Send when opened
          } else {
            // Continue to broadcast new messages to let that peer has time to connect to the rest in room
            this.broadcastService.broadcastNewMessagesToConnUntil(
              fromConn,
              BROADCAST_TILL_MILLI_SECONDS_LATER,
              this.connsToBroadcast
            );
            this.broadcastService.sendOldCRDTs(fromConn); // Send now
            this.broadcastService.sendChangeLanguage(fromConn);
          }
        }
        break;

      // The peer we asked to send us oldCRDTs don't have them (They're new in room too)
      case MessageType.CannotSendOldCRDTs:
        alert(
          'The peer we picked to send us old messages cannot send. Reloading...'
        );
        window.location.reload(true);
        break;

      /**
       * Handle Chat messages related requests
       */

      // Somebody sends us a chat message
      case MessageType.ChatMessage:
        this.broadcastService.broadcastMessageToNewPeers(
          message,
          this.connsToBroadcast
        );
        PeerUtils.addUniqueMessages([message], this.previousChatMessages);
        PeerUtils.broadcastInfo(BroadcastInfo.UpdateChatMessages);
        break;

      // Somebody sends us old chat messages (We just joined room)
      case MessageType.OldChatMessages:
        this.hasReceivedAllChatMessages = true;
        const messages: Message[] = JSON.parse(message.content);
        PeerUtils.addUniqueMessages(messages, this.previousChatMessages);
        PeerUtils.broadcastInfo(BroadcastInfo.UpdateChatMessages);
        break;

      // Somebody asked us to send them old chat messages (They just joined room)
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
          // Only send when connection has opened
          if (
            !PeerUtils.connectionHasOpened(fromConn, this.connectionsIAmHolding)
          ) {
            this.peerIdsToSendOldChatMessages.push(fromConn.peer); // Send when opened
          } else {
            this.broadcastService.sendOldMessages(
              fromConn,
              this.previousChatMessages
            ); // send now
          }
        }
        break;

      /**
       * Change Cursor, Select, Name messages
       */
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
          // Have both name and color => Add to list
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
          // Have both name and color => Add to list
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

      /**
       * Other messages
       */

      // That peer has received all CRDTs. We can display their name now
      case MessageType.CanDisplayMeJustJoinRoom:
        PeerUtils.broadcastInfo(BroadcastInfo.NewPeerJoining);
        this.broadcastService.alert(
          this.nameService.getPeerName(fromConn.peer) + ' just joined room', AlertType.Success
        );
        break;
      default:
        console.log(message);
        throw new Error('Unhandled messageType');

      // Somebody change monaco's language
      case MessageType.ChangeLanguage:
        EditorService.language = message.content;
        PeerUtils.broadcastInfo(BroadcastInfo.ChangeLanguage);
        this.alertifyService.message(
          'Language has been changed to ' + message.content
        );
        break;
    }
  }

  private handleConnectionClose(conn: any) {
    console.log(
      'Connection to ' +
        conn.peer +
        ' is closed. It will be deleted in the connectionsIAmHolding list!'
    );

    // Delete conn from connectionsIAmHolding
    const index = this.connectionsIAmHolding.findIndex(
      (connection) => connection === conn
    );
    this.connectionsIAmHolding.splice(index, 1);

    // Delete the peer's nameColor
    this.nameColorList = this.nameColorList.filter(
      (x) => x.ofPeerId !== conn.peer
    );

    // IMPORTANT: Must be after delete peer's nameColor out of the list
    // Delete the peer's cursor, select,...
    this.peerIdJustLeft = conn.peer;
    PeerUtils.broadcastInfo(BroadcastInfo.PeerLeft);

    // Tell user that the peer just left room
    const name = this.nameService.getPeerName(conn.peer);
    this.broadcastService.alert(name + ' just left', AlertType.Warning);
  }

  //***************** Handle when join room *******************
  private handleFirstJoinRoom(
    peerIds: any[],
    receivedAllMessages: boolean[],
    cursorColors: number[],
    cursorColor: number
  ) {
    // Set peers-in-room's cursor colors
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
      // We join an existing room => Pick a random peer to give us oldCRDTs, old chat messages
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
        // Handle edge case: That peer leaves before finishing sending us oldCRDTs and old chat messages
        this.waitTillGotAllMessagesOrRefreshIfThatPeerLeft(peerIdPicked);
      }
    }
  }

  /**
   * Take info from C# server to determine which peer has received all CRDTs and chat messages
   * and which peer hasn't. Then pick a random, 'ready' peer
   */
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

  /**
   * If the peer hasn's finished sending us oldCRDTs, asking C# server
   * every 3 seconds to see if that peer has left. Refresh if he has left to rejoin room
   */
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

  //*************************************************************

  createNewRoom() {
    this.roomService
      .joinNewRoom(this.peer.id)
      .subscribe((data: EnterRoomInfo) => {
        this.roomName = data.roomName;
        EditorService.setSiteId(data.siteId);
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
        // SQL server doesn't have bool. We have to use 1 and 0. Mapping 1 and 0 back to bool
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

  sendMessage(content: string) {
    this.broadcastService.sendMessage(
      content,
      this.connectionsIAmHolding,
      this.previousChatMessages
    );
  }

  broadcastChangeCursorPos(event: any) {
    this.broadcastService.broadcastChangeCursorPos(
      event,
      this.connectionsIAmHolding
    );
  }

  broadcastChangeSelectionPos(event: any) {
    this.broadcastService.broadcastChangeSelectionPos(
      event,
      this.connectionsIAmHolding
    );
  }

  broadcastChangeLanguage() {
    this.broadcastService.broadcastChangeLanguage(this.connectionsIAmHolding);
  }

  /**
   *   Broadcast CRDTs to all peers when local insert / remove
   */
  private subscribeToEditorServiceEvents() {
    this.editorService.crdtEvent.subscribe((insert: boolean) => {
      if (insert) {
        this.broadcastService.broadcastInsertOrRemove(
          this.editorService.getCrdtsToTransfer(),
          true,
          this.connectionsIAmHolding
        );
      } else {
        this.broadcastService.broadcastInsertOrRemove(
          this.editorService.getCrdtsToTransfer(),
          false,
          this.connectionsIAmHolding
        );
      }
    });
  }
}
