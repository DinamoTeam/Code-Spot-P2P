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
import { AnnounceType } from '../shared/AnnounceType';
import { AlertType } from '../shared/AlertType';
import { NameService } from './name.service';
import { NameColor } from '../shared/NameColor';
import { BroadcastService } from './broadcast.service';
import { environment } from 'src/environments/environment';

declare const Peer: any;
const STOP_BROADCAST_AFTER_MILLI_SECONDS = 5000;
@Injectable({
  providedIn: 'root',
})
export class PeerService {
  private peer: any;
  private roomName: string;
  private connToGetOldMessages: any;
  private peerIdsToSendOldCrdtsAndOldChatMessages: string[] = [];
  private peerIdsInRoomWhenFirstEnter: any[] = [];
  private connectionsIAmHolding: any[] = [];
  private hasReceivedAllOldCRDTs = false;
  private hasReceivedOldChatMessages = false;
  private newlyJoinedConnsNeededBroadcasting: any[] = [];
  private receivedRemoteCrdts: CRDT[];
  private peerIdWhoSentCrdts: string;
  private cursorChangeInfo: CursorChangeInfo;
  private selectionChangeInfo: SelectionChangeInfo;
  private previousChatMessages: Message[] = [];
  private peerIdJustLeft: string;
  private nameColorList: NameColor[] = [];
  private hasNotShowInternetDisconnect = true;
  connectionEstablished = new EventEmitter<boolean>();

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
      host: environment.peerServerHost,
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
      debug: 2, // Print only errors and warnings
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
      if (this.hasNotShowInternetDisconnect) {
        this.hasNotShowInternetDisconnect = false;
        this.peer.destroy();
        PeerUtils.handlePeerError(
          'Please check your Internet connection. Going back to Home page?'
        );
      }
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
    console.log('Connection to peer ' + conn.peer + ' opened :)');

    const myName = this.nameService.getPeerName(this.peer.id);
    this.broadcastService.sendNameAndCursorInfo(conn, myName);

    // Only add this connection to our list when it has been opened!
    Utils.addUniqueConnections([conn], this.connectionsIAmHolding);

    const needToSendOldData = Utils.inArray(
      conn.peer,
      this.peerIdsToSendOldCrdtsAndOldChatMessages
    );
    if (needToSendOldData) {
      // Broadcast new CRDTs, new chat messages and other changes to this new peer until we are sure he
      // has received all oldCRDTs and has connected to the rest in room
      this.newlyJoinedConnsNeededBroadcasting.push(conn);

      this.broadcastService.sendOldData(
        conn,
        this.previousChatMessages,
        this.editorService.getOldCRDTsAsSortedArray()
      );

      this.peerIdsToSendOldCrdtsAndOldChatMessages = this.peerIdsToSendOldCrdtsAndOldChatMessages.filter(
        (id) => id !== conn.peer
      );
    }

    const askForOldData = this.connToGetOldMessages === conn;
    if (askForOldData) {
      this.broadcastService.requestOldMessages(
        conn,
        MessageType.RequestOldCRDTsAndChatMessages
      );
    }

    // If we just join room (this peer is here before us) and are ready (have received all CRDTs and Chat Messages)
    const justJoinRoomAndAreReady =
      this.peerIdsInRoomWhenFirstEnter.find((id) => id === conn.peer) &&
      this.hasReceivedAllOldCRDTs &&
      this.hasReceivedOldChatMessages;

    if (justJoinRoomAndAreReady) {
      conn.send(
        new Message(null, MessageType.CanDisplayMeJustJoinRoom, this.peer.id)
      );
    }
  }

  /**
   * Is called when a peer send us a message
   * Note: PeerUtils.announceInfo() is to notify code-editor.component.ts
   */
  private handleMessageFromPeer(message: Message, fromConn: any) {
    if (this.needToBroadcastThisMessageToNewPeers(message)) {
      this.broadcastService.broadcastMessageToNewPeers(
        message,
        this.newlyJoinedConnsNeededBroadcasting
      );
    }

    switch (message.messageType) {
      /**
       * CRDT related requests
       */
      case MessageType.RemoteInsert:
      case MessageType.RemoteRemove:
      case MessageType.OldCRDTs:
      case MessageType.OldCRDTsLastBatch:
        // message.content will be empty when the peer send oldCRDT and the screen is empty
        if (message.content !== '') {
          this.handleCRDTMessage(message);
        }
        if (message.messageType === MessageType.OldCRDTsLastBatch) {
          this.handleCRDTLastBatch(fromConn);
        }
        break;

      case MessageType.RequestOldCRDTsAndChatMessages:
        this.handleOldDataRequest(fromConn);
        break;

      // The peer we asked to send us oldCRDTs don't have them (They're new in room too)
      case MessageType.CannotSendOldCRDTsOrOldChatMessages:
        this.displayPeerCannotSendOldDataAndReload();
        break;

      /**
       * Handle Chat messages related requests
       */
      case MessageType.ChatMessage:
        this.storeAndDisplayChatMessage(message);
        break;

      case MessageType.OldChatMessages:
        this.hasReceivedOldChatMessages = true;
        this.storeAndDisplayOldChatMessages(message);
        break;

      /**
       * Change Cursor, Select, Name messages
       */
      case MessageType.ChangeCursor:
        this.updatePeerCursorPos(fromConn, message);
        break;
      case MessageType.ChangeSelect:
        this.updatePeerSelectionPos(fromConn, message);
        break;
      case MessageType.CursorColor:
        this.updatePeerColor(fromConn, message);
        break;
      case MessageType.Name:
        this.addNewPeerName(fromConn, message);
        break;

      /**
       * Other messages
       */

      // That peer has received all CRDTs. We can display their name now
      case MessageType.CanDisplayMeJustJoinRoom:
        // We will soon no longer need to broadcast that peer messages from other peers.
        // We give that peer a few seconds to connect to the rest in room
        this.stopBroadcastingAfter(
          fromConn,
          STOP_BROADCAST_AFTER_MILLI_SECONDS
        );
        this.alertPeerJoinRoom(fromConn);
        break;

      case MessageType.ChangeLanguage:
        const languageIsChanged =
          EditorService.currentLanguage !== message.content;
        const isDefaultLanguage =
          EditorService.currentLanguage === EditorService.defaultLanguage;
        if (languageIsChanged || isDefaultLanguage) {
          this.changeLanguageAndAlertThisChange(message);
        }
        break;

      case MessageType.ChangeName:
        this.changePeerNameAndAlertThisChange(message);
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

    this.stopBroadcastingAfter(conn, 0);

    // Delete conn from connectionsIAmHolding
    const index = this.connectionsIAmHolding.findIndex(
      (connection) => connection === conn
    );
    this.connectionsIAmHolding.splice(index, 1);

    // Delete the peer's nameColor
    this.nameColorList = this.nameColorList.filter(
      (x) => x.ofPeerId !== conn.peer
    );

    // IMPORTANT: Must be after delete peer's nameColor
    // Delete the peer's cursor, select,...
    this.peerIdJustLeft = conn.peer;
    PeerUtils.announceInfo(AnnounceType.PeerLeft);

    // Tell user that the peer just left room
    const name = this.nameService.getPeerName(conn.peer);
    Utils.alert(name + ' just left', AlertType.Warning);
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
        this.nameService.getPeerName(this.peer.id) + ' (You)',
        this.cursorService.getPeerColor(this.peer.id),
        this.peer.id
      )
    );

    PeerUtils.announceInfo(AnnounceType.NewPeerJoining);

    const iAmTheFirstInRoom = peerIds.length === 0;
    if (iAmTheFirstInRoom) {
      console.log('I am the first one in this room');
      this.hasReceivedAllOldCRDTs = true;
      this.hasReceivedOldChatMessages = true;
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

  private updateNameColorList(peerId, newName) {
    const nameColorIndex = this.nameColorList.findIndex(
      (elem) => elem.ofPeerId === peerId
    );
    this.nameColorList[nameColorIndex].name = newName;
  }

  //*************************************************************

  createNewRoom() {
    this.roomService
      .joinNewRoom(this.peer.id)
      .subscribe((data: EnterRoomInfo) => {
        this.roomName = data.roomName;
        EditorService.setSiteId(data.siteId);
        this.handleFirstJoinRoom([], [], [], data.cursorColor);
        PeerUtils.announceInfo(AnnounceType.RoomName);
        PeerUtils.announceInfo(AnnounceType.ReadyToDisplayMonaco);
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

  getPeerIdWhoSentCrdts(): string {
    return this.peerIdWhoSentCrdts;
  }

  getMyPeerId(): string {
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
    this.broadcastService.broadcastChatMessage(
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

  broadcastChangeName(newName: string) {
    this.broadcastService.broadcastChangeName(
      this.connectionsIAmHolding,
      newName
    );
  }

  /**
   * When a peer just join room and ask us to send OldCRDTs, he is not yet connected to
   * the rest in room. If any peer in room send a message, he will not receive it.
   * To fix this problem, we broadcast any new messages to him.
   *
   * This function is called when that new peer is almost 'ready'. He has received oldCRDTs
   * and are connecting to the rest in room. We allow him a few seconds before we stop broadcasting.
   *
   * Note: Of course we still broadcast message from us to him.
   */
  stopBroadcastingAfter(conn: any, milliSecondsLater: number) {
    const that = this;
    setTimeout(function () {
      that.newlyJoinedConnsNeededBroadcasting = that.newlyJoinedConnsNeededBroadcasting.filter(
        (connection) => connection.peer !== conn.peer
      );
    }, milliSecondsLater);
  }

  getMyName(): string {
    return this.nameService.getPeerName(this.peer.id);
  }

  changeMyName(newName: string) {
    this.nameService.setPeerName(this.peer.id, newName);
    this.updateNameColorList(this.peer.id, newName + ' (You)');
    PeerUtils.announceInfo(AnnounceType.ChangeMyName);
  }

  private handleCRDTMessage(message: Message) {
    const crdts = CrdtUtils.stringToCRDTArr(
      message.content,
      BroadcastService.CRDTDelimiter
    );
    this.receivedRemoteCrdts = crdts;
    this.peerIdWhoSentCrdts = message.fromPeerId;
    if (message.messageType === MessageType.RemoteInsert) {
      PeerUtils.announceInfo(AnnounceType.RemoteInsert);
    } else if (message.messageType === MessageType.RemoteRemove) {
      PeerUtils.announceInfo(AnnounceType.RemoteRemove);
    } else {
      PeerUtils.announceInfo(AnnounceType.RemoteAllMessages);
    }
  }

  private handleCRDTLastBatch(fromConn: any) {
    this.hasReceivedAllOldCRDTs = true;
    PeerUtils.announceInfo(AnnounceType.ReadyToDisplayMonaco);
    this.connectToTheRestInRoom(this.connToGetOldMessages.peer);
    // Tell C# Server I have received all CRDTs
    this.roomService.markPeerReceivedAllMessages(this.peer.id);
    // Send cursor + selection change info
    this.broadcastService.sendCursorInfo(fromConn);
    // Tell that user they can display us just join room now
    fromConn.send(
      new Message(null, MessageType.CanDisplayMeJustJoinRoom, this.peer.id)
    );
  }

  private handleOldDataRequest(fromConn: any) {
    const canSend =
      this.hasReceivedAllOldCRDTs && this.hasReceivedOldChatMessages;
    if (!canSend) {
      this.broadcastService.tellPeerCannotSendOldData(fromConn);
    } else {
      // Only send when connection has opened
      if (
        !PeerUtils.connectionHasOpened(fromConn, this.connectionsIAmHolding)
      ) {
        this.peerIdsToSendOldCrdtsAndOldChatMessages.push(fromConn.peer); // Send when opened
      } else {
        // Broadcast new CRDTs, new chat messages to this new peer until we are sure he
        // has received all oldCRDTs and has connected to the rest in room
        this.newlyJoinedConnsNeededBroadcasting.push(fromConn);

        this.broadcastService.sendOldData(
          fromConn,
          this.previousChatMessages,
          this.editorService.getOldCRDTsAsSortedArray()
        ); // Send now
      }
    }
  }

  private displayPeerCannotSendOldDataAndReload() {
    Utils.alert(
      'The peer we picked to send us old messages cannot send. Reloading...',
      AlertType.Error
    );
    window.location.reload(true);
  }

  private storeAndDisplayChatMessage(message: Message) {
    PeerUtils.addUniqueMessages([message], this.previousChatMessages);
    PeerUtils.announceInfo(AnnounceType.UpdateChatMessages);
  }

  private storeAndDisplayOldChatMessages(message: Message) {
    const messages: Message[] = JSON.parse(message.content);
    PeerUtils.addUniqueMessages(messages, this.previousChatMessages);
    PeerUtils.announceInfo(AnnounceType.UpdateChatMessages);
  }

  private updatePeerCursorPos(fromConn: any, message: Message) {
    const cursorEvent = JSON.parse(message.content);
    this.cursorChangeInfo = new CursorChangeInfo(
      cursorEvent.position.lineNumber,
      cursorEvent.position.column,
      fromConn.peer,
      cursorEvent.source,
      cursorEvent.reason
    );
    PeerUtils.announceInfo(AnnounceType.CursorChange);
  }

  private updatePeerSelectionPos(fromConn: any, message: Message) {
    const selectEvent = JSON.parse(message.content);
    this.selectionChangeInfo = new SelectionChangeInfo(
      selectEvent.selection.startLineNumber,
      selectEvent.selection.startColumn,
      selectEvent.selection.endLineNumber,
      selectEvent.selection.endColumn,
      fromConn.peer,
      selectEvent.source,
      selectEvent.reason
    );
    PeerUtils.announceInfo(AnnounceType.SelectionChange);
  }

  private updatePeerColor(fromConn: any, message: Message) {
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
  }

  private addNewPeerName(fromConn: any, message: Message) {
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
  }

  private alertPeerJoinRoom(fromConn: any) {
    PeerUtils.announceInfo(AnnounceType.NewPeerJoining);
    Utils.alert(
      this.nameService.getPeerName(fromConn.peer) + ' just joined room',
      AlertType.Success
    );
  }

  private changeLanguageAndAlertThisChange(message: Message) {
    EditorService.currentLanguage = message.content;
    PeerUtils.announceInfo(AnnounceType.ChangeLanguage);
    Utils.alert(
      'Language has been changed to ' + Utils.getLanguageName(message.content),
      AlertType.Message
    );
  }

  private changePeerNameAndAlertThisChange(message: Message) {
    const fromPeerId = message.fromPeerId;
    const oldName = this.nameService.getPeerName(fromPeerId);
    const newName = message.content;
    if (oldName !== newName) {
      this.nameService.setPeerName(fromPeerId, newName);
      this.updateNameColorList(fromPeerId, newName);

      PeerUtils.announceInfo(AnnounceType.ChangePeerName);
      Utils.alert(
        oldName + ' has changed their name to ' + newName,
        AlertType.Message
      );
    }
  }

  private needToBroadcastThisMessageToNewPeers(message: Message): boolean {
    return (
      message.messageType === MessageType.RemoteInsert ||
      message.messageType === MessageType.RemoteRemove ||
      message.messageType === MessageType.ChatMessage ||
      message.messageType === MessageType.ChangeLanguage ||
      message.messageType === MessageType.ChangeName
    );
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
