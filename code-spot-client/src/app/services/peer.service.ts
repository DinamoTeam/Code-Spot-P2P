import { EventEmitter, Injectable } from '@angular/core';
import { Message, MessageType } from '../shared/Message';
import { RoomService } from './room.service';
import { CRDT } from '../shared/CRDT';
import { EditorService } from './editor.service';
import { Subject, Observable } from 'rxjs';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';

declare const Peer: any;
const MAX_CRDT_PER_SEND = 500;
@Injectable({
  providedIn: 'root',
})
export class PeerService {
  private timeWaitForAck = 1000; // Millisecond
  private time = 0;
  private peer: any;
  private roomName: string;
  private connToGetOldMessages: any;
  private peerIdsToSendOldMessages: string[] = [];
  private peerIdsInRoom: any[] = [];
  private connectionsIAmHolding: any[] = [];
  private messagesToBeAcknowledged: Message[] = [];
  private hasReceivedAllMessages = false;
  connectionEstablished = new EventEmitter<boolean>();
  infoBroadcasted = new EventEmitter<BroadcastInfo>();
  receivedRemoteCrdts: CRDT[];

  constructor(
    private roomService: RoomService,
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
      debug: 3, // Print all logs
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
      // TODO: refresh browser or sth like that
    });
  }

  private logErrors() {
    this.peer.on(PeerEvent.Error, (error) => {
      console.error('PeerServer error: ');
      console.error(error);
    });
  }
  //*************************************************************

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

    if (getOldMessages === true) {
      this.connToGetOldMessages = conn;
    }
    console.log('I just send peer: ' + otherPeerId + ' a connection request');
    this.setupListenerForConnection(conn);
  }

  private connectToTheRestInRoom(exceptPeerId: any) {
    this.peerIdsInRoom.forEach((peerId) => {
      if (peerId !== exceptPeerId) {
        this.connectToPeer(peerId, false);
      }
    });
  }

  private setupListenerForConnection(conn: any) {
    // When the connection first establish
    conn.on(ConnectionEvent.Open, () => {
      console.log('Connection to peer ' + conn.peer + ' opened :)');
      // Only add this conn to our list when the connection has opened!
      this.addUniqueConnections([conn], this.connectionsIAmHolding);
      // If we need to send this peer old messages
      if (
        this.peerIdsToSendOldMessages.findIndex((id) => id === conn.peer) !== -1
      ) {
        this.sendOldCRDTs(conn);
        this.peerIdsToSendOldMessages.filter((id) => id !== conn.peer);
        this.sendChangeLanguage(conn);
      }
      // If we chose this peer to give us all messages
      if (this.connToGetOldMessages === conn) {
        this.requestOldCRDTs(conn);
      }
    });
    // the other peer send us some data
    conn.on(ConnectionEvent.Data, (message) =>
      this.handleMessageFromPeer(message, conn)
    );
    // either us or the other peer close the connection
    conn.on(ConnectionEvent.Close, () => this.handleConnectionClose(conn));

    conn.on(ConnectionEvent.Error, (error) => {
      console.error('Connection error: ');
      console.error(error);
    });
  }

  private handleMessageFromPeer(message: Message, fromConn: any) {
    switch (message.messageType) {
      case MessageType.ChangeLanguage:
        EditorService.language = message.content;
        this.infoBroadcasted.emit(BroadcastInfo.ChangeLanguage);
        break;
      case MessageType.RemoteInsert:
      case MessageType.RemoteRemove:
      case MessageType.OldCRDTs:
      case MessageType.OldCRDTsLastBatch:
        // Acknowledge
        // fromConn.send(
        //   new Message(null, MessageType.Acknowledge, null, null, message.time)
        // );
        const parsedCrdts: CRDT[] = JSON.parse(message.content); // plain Javascript object
        const crdts = parsedCrdts.map((crdt) =>
          CRDT.plainObjectToRealCRDT(crdt)
        );

        this.receivedRemoteCrdts = crdts;

        if (message.messageType === MessageType.RemoteInsert) {
          console.log('Receive Remote Insert');
          // peerMessagesTracker.receiveRemoteInserts(crdts);
          this.infoBroadcasted.emit(BroadcastInfo.RemoteInsert);
          // peerMessagesTracker.processDeleteBuffer();
        } else if (message.messageType === MessageType.RemoteRemove) {
          console.log('Receive Remote Remove');
          // peerMessagesTracker.receiveRemoteRemoves(crdts);
          this.infoBroadcasted.emit(BroadcastInfo.RemoteRemove);
        } else {
          console.log('Receive All Messages');
          // peerMessagesTracker.receiveRemoteInserts(crdts);
          this.infoBroadcasted.emit(BroadcastInfo.RemoteAllMessages);
          if (message.messageType === MessageType.OldCRDTsLastBatch) {
            this.hasReceivedAllMessages = true;
            this.infoBroadcasted.emit(BroadcastInfo.ReadyToDisplayMonaco);
            this.connectToTheRestInRoom(this.connToGetOldMessages.peer);
          }
        }
        break;
      case MessageType.RequestOldCRDTs:
        if (!this.hasReceivedAllMessages) {
          console.log(
            "I haven't received allMessages yet. Can't send to that peer"
          );
        } else {
          console.log(this.connectionsIAmHolding);
          // If connection hasn't opened
          if (
            this.connectionsIAmHolding.findIndex(
              (conn) => conn.peer === fromConn.peer
            ) === -1
          ) {
            this.peerIdsToSendOldMessages.push(fromConn.peer); // Send when opened
          } else {
            this.sendOldCRDTs(fromConn); // send now
            this.sendChangeLanguage(fromConn);
          }
        }
        break;
      case MessageType.Acknowledge:
        const indexDelete = this.messagesToBeAcknowledged.findIndex(
          (mes) => mes.time === message.time
        );
        if (indexDelete !== -1) {
          this.messagesToBeAcknowledged.splice(indexDelete, 1);
        }
        break;

      default:
        throw new Error('Unhandled messageType');
    }
  }

  private handleConnectionClose(conn: any) {
    // console.log(
    //   'Connection to ' +
    //     conn.peer +
    //     ' is closed. It will be deleted in the connectionsIAmHolding list!'
    // );
    console.log(
      'Connection to ' +
        conn.peer +
        ' is closed but is not be deleted! We want to see if we can still send messages or not. One question: Who close this connection?! Is it because wifi disconnects?'
    );
    const index = this.connectionsIAmHolding.findIndex(
      (connection) => connection === conn
    );
    this.connectionsIAmHolding.splice(index, 1);
  }

  //***************** Handle when join room *******************
  private handleFirstJoinRoom(peerIds: any[]) {
    if (peerIds.length === 0) {
      // DO NOTHING
      console.log('I am the first one in this room');
      this.hasReceivedAllMessages = true;
    } else {
      this.peerIdsInRoom = peerIds;
      const randIndex = Math.floor(Math.random() * peerIds.length);
      this.connectToPeer(peerIds[randIndex], true);
      // this.connectToPeer(peerIds[0], true); // For testing only
      const that = this;
      setTimeout(function () {
        if (!that.hasReceivedAllMessages) {
          // The peer we intended to get old messages from just left the room or is taking to long to answer
          console.log(
            'The peer we intended to get old messages from just left the room or is taking to long to answer. Reloading'
          );
          window.location.reload(true);
        }
      }, 40000);
    }
  }

  private requestOldCRDTs(conn: any) {
    const message = new Message(
      null,
      MessageType.RequestOldCRDTs,
      null,
      null,
      this.time++
    );
    conn.send(message);
  }

  private sendOldCRDTs(conn: any) {
    const previousCRDTs: CRDT[] = this.editorService.getOldCRDTsAsSortedArray();

    // Break huge crdts array into smaller arrays and send each one to avoid connection crash
    const crdtBatches: CRDT[][] = [];
    const numberOfTimesSend = Math.ceil(
      previousCRDTs.length / MAX_CRDT_PER_SEND
    );
    for (let i = 0; i < numberOfTimesSend; i++) {
      const startInclusive = MAX_CRDT_PER_SEND * i;
      // Taking care of the case: sending the last batch
      const endExclusive = Math.min(
        MAX_CRDT_PER_SEND * (i + 1),
        previousCRDTs.length
      );
      crdtBatches.push(previousCRDTs.slice(startInclusive, endExclusive));
    }

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

    // this.messagesToBeAcknowledged.push(message);
    // const that = this; // setTimeOut will not know what 'this' is => Store 'this' in a variable
    // setTimeout(function () {
    //   that.acknowledgeOrResend(message);
    // }, that.timeWaitForAck);
  }
  //*************************************************************

  private addUniqueConnections(list: any[], listToBeAddedTo: any[]) {
    list.forEach((obj) => {
      let hasExist = false;
      for (let i = 0; i < listToBeAddedTo.length; i++) {
        if (obj.peer === listToBeAddedTo[i].peer) {
          hasExist = true;
          break;
        }
      }
      if (!hasExist) {
        listToBeAddedTo.push(obj);
      }
    });
  }

  createNewRoom() {
    this.roomService
      .joinNewRoom(this.peer.id)
      .subscribe((data: EnterRoomInfo) => {
        this.roomName = data.roomName;
        EditorService.setSiteId(data.siteId);
        // No peerId
        this.handleFirstJoinRoom([]);
        this.infoBroadcasted.emit(BroadcastInfo.RoomName);
        this.infoBroadcasted.emit(BroadcastInfo.ReadyToDisplayMonaco);
      });
  }

  joinExistingRoom(roomName: string) {
    this.roomName = roomName;
    this.roomService.joinExistingRoom(this.peer.id, this.roomName).subscribe(
      (data: EnterRoomInfo) => {
        if (data.siteId === -1) {
          // Either room not exists or has been deleted
          window.location.replace('/');
          alert('Room not exists, navigating back to home');
        }
        EditorService.setSiteId(data.siteId);
        this.handleFirstJoinRoom(data.peerIds);
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

    // Break huge crdts array into smaller arrays and send each one to avoid connection crash
    const crdtBatches: CRDT[][] = [];
    const numberOfTimesSend = Math.ceil(crdts.length / MAX_CRDT_PER_SEND);
    for (let i = 0; i < numberOfTimesSend; i++) {
      const startInclusive = MAX_CRDT_PER_SEND * i;
      const endExclusive = Math.min(MAX_CRDT_PER_SEND * (i + 1), crdts.length); // In case sending the last batch
      crdtBatches.push(crdts.slice(startInclusive, endExclusive));
    }

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
        // this.messagesToBeAcknowledged.push(messageToSend);
        // const that = this; // setTimeOut will not know what 'this' is => Store 'this' in a variable
        // setTimeout(function () {
        //   that.acknowledgeOrResend(messageToSend);
        // }, that.timeWaitForAck);
      });
    }
  }

  acknowledgeOrResend(mess: Message, hasSent = 0) {
    // If message hasn't been received
    if (
      this.messagesToBeAcknowledged.find(
        (message) => message.time === mess.time
      )
    ) {
      const conn = this.connectionsIAmHolding.find(
        (connection) => connection.peer === mess.toPeerId
      );
      // Has sent for more than 5 times
      if (hasSent > 5) {
        this.connectionsIAmHolding = this.connectionsIAmHolding.filter(
          (connection) => connection.peer !== conn.peer
        );
        return;
      }

      // If that peer hasn't disconnect
      if (conn) {
        conn.send(mess);
        console.log('Waiting too long for ack. Resent messages');
        const that = this; // setTimeOut will not know what 'this' is => Store 'this' in a variable
        setTimeout(function () {
          that.acknowledgeOrResend(mess, hasSent + 1);
        }, that.timeWaitForAck);
      }
    }
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

  getMessagesToBeAck(): any[] {
    return this.messagesToBeAcknowledged;
  }

  subscribeToEditorServiceEvents() {
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

export const enum PeerEvent {
  Open = 'open',
  Close = 'close',
  Connection = 'connection',
  Data = 'data',
  Disconnected = 'disconnected',
  Error = 'error',
}

export const enum ConnectionEvent {
  Open = 'open',
  Close = 'close',
  Data = 'data',
  Error = 'error',
}

export const enum BroadcastInfo {
  UpdateAllMessages = 0,
  RoomName = 1,
  RemoteInsert = 2,
  RemoteRemove = 3,
  RemoteAllMessages = 4,
  ChangeLanguage = 5,
  ReadyToDisplayMonaco = 6,
}
