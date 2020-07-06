import { EventEmitter, Injectable } from '@angular/core';
import { Message, MessageType } from '../shared/Message';
import { RoomService } from './room.service';
import { Router } from '@angular/router';
import { CRDT } from '../shared/CRDT';
import { EditorService } from './editor.service';
import { Subject, Observable } from 'rxjs';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';

declare const Peer: any;
const MAX_CRDT_PER_SEND = 1000;
@Injectable({
  providedIn: 'root',
})
export class PeerService {
  private timeWaitForAck = 1000; // Millisecond
  private time = 0;
  private peer: any;
  private roomName: string;
  private connToGetOldMessages: any;
  private peerIdsInRoom: any[] = [];
  private connectionsIAmHolding: any[] = [];
  private messagesToBeAcknowledged: Message[] = [];
  private hasReceivedAllMessages = false;
  connectionEstablished = new EventEmitter<Boolean>();
  infoBroadcasted = new EventEmitter<BroadcastInfo>();

  receivedRemotCrdts: CRDT[];


  //private remoteInsertSubject = new Subject<CRDT[]>();
  //private remoteRemoveSubject = new Subject<CRDT[]>();
  //private AllMessagesSubject = new Subject<CRDT[]>();

  constructor(
    private roomService: RoomService,
    private router: Router,
    private editorService: EditorService
  ) {
    // Create a new peer and connect to peerServer. We can get our id from this.peer.id
    this.peer = new Peer({
      host: 'codespotpeerserver.herokuapp.com/',
      port: '/..',
      secure: true
    });
    /*this.peer = new Peer({
      host: 'localhost',
      port: 9000,
      path: '/myapp',
    });*/
    this.connectToPeerServer();
    this.registerConnectToMeEvent();
    this.reconnectToPeerServer();
    this.subscribeToEditorServiceEvents();
  }

  //************* Connect + Reconnect to PeerServer *************
  private connectToPeerServer() {
    this.peer.on(PeerEvent.Open, (myId: string) => {
      console.log('I have connected to peerServer. My id: ' + myId);
      this.connectionEstablished.emit(true);
    });
  }

  private reconnectToPeerServer() {
    this.peer.on(PeerEvent.Disconnected, () => {
      // Disconnect => destroy permanently this peer. Need to test this more!
      this.peer.destroy();
      // TODO: refresh browser or sth like that
    });
  }
  //*************************************************************

  private registerConnectToMeEvent() {
    this.peer.on(PeerEvent.Connection, (conn: any) => {
      console.log(
        'A peer with connectionId: ' + conn.peer + ' have just connected to me'
      );
      this.setupListenerForConnection(conn);
    });
  }

  private connectToPeer(otherPeerId: any, getOldMessages: boolean) {
    const conn = this.peer.connect(otherPeerId, {
      reliable: true,
      serialization: 'json',
    });
    this.addUniqueConnections([conn], this.connectionsIAmHolding);

    if (getOldMessages === true) {
      this.connToGetOldMessages = conn;
    }
    console.log('I just connected to peer with id: ' + otherPeerId);
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
    this.addUniqueConnections([conn], this.connectionsIAmHolding);
    // When the connection first establish
    conn.on(ConnectionEvent.Open, () => {
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
  }

  private handleMessageFromPeer(message: Message, fromConn: any) {
    switch (message.messageType) {
      case MessageType.RemoteInsert:
      case MessageType.RemoteRemove:
      case MessageType.OldCRDTs:
        // Acknowledge
        fromConn.send(
          new Message(null, MessageType.Acknowledge, null, null, message.time)
        );
        const parsedCrdts: CRDT[] = JSON.parse(message.content); // plain Javascript object
        const crdts = parsedCrdts.map((crdt) =>
          CRDT.plainObjectToRealCRDT(crdt)
        );

        this.receivedRemotCrdts = crdts;

        if (message.messageType === MessageType.RemoteInsert) {
          // peerMessagesTracker.receiveRemoteInserts(crdts);
          this.infoBroadcasted.emit(BroadcastInfo.RemoteInsert);
          // peerMessagesTracker.processDeleteBuffer();
        } else if (message.messageType === MessageType.RemoteRemove) {
          // peerMessagesTracker.receiveRemoteRemoves(crdts);
          this.infoBroadcasted.emit(BroadcastInfo.RemoteRemove);
        } else {
          // peerMessagesTracker.receiveRemoteInserts(crdts);
          this.hasReceivedAllMessages = true;
          this.infoBroadcasted.emit(BroadcastInfo.RemoteAllMessages);
          console.log(this.connectionsIAmHolding);
          this.connectToTheRestInRoom(this.connToGetOldMessages);
        }
        break;

      case MessageType.RequestOldCRDTs:
        if (!this.hasReceivedAllMessages) {
          console.log(
            "I haven't received allMessages yet. Can't send to that peer"
          );
        } else {
          this.sendOldCRDTs(fromConn);
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
  private handleFirstJoinRoom(peerIds: any[]) {
    if (peerIds.length === 0) {
      // DO NOTHING
      console.log('I am the first one in this room');
      this.hasReceivedAllMessages = true;
    } else {
      this.peerIdsInRoom = peerIds;
      const randIndex = Math.floor(Math.random() * peerIds.length);
      this.connectToPeer(peerIds[randIndex], true);
      const that = this;
      setTimeout(function () {
        if (!that.hasReceivedAllMessages) {
          // The peer we intended to get old messages from just left the room or is taking to long to answer
          console.log(
            'The peer we intended to get old messages from just left the room or is taking to long to answer. Reloading'
          );
          window.location.reload(true);
        }
      }, 4000);
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
    const message = new Message(
      JSON.stringify(previousCRDTs),
      MessageType.OldCRDTs,
      this.peer.id,
      conn.peer,
      this.time++
    );
    conn.send(message);
    this.messagesToBeAcknowledged.push(message);
    const that = this; // setTimeOut will not know what 'this' is => Store 'this' in a variable
    setTimeout(function () {
      that.acknowledgeOrResend(message);
    }, that.timeWaitForAck);
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
        console.log('roomName: ' + this.roomName);
        EditorService.setSiteId(data.siteId);
        // No peerId
        this.handleFirstJoinRoom([]);
        this.infoBroadcasted.emit(BroadcastInfo.RoomName);
      });
  }

  joinExistingRoom(roomName: string) {
    this.roomName = roomName;
    this.roomService.joinExistingRoom(this.peer.id, this.roomName).subscribe(
      (data: EnterRoomInfo) => {
        console.log(data);
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
        this.messagesToBeAcknowledged.push(messageToSend);
        const that = this; // setTimeOut will not know what 'this' is => Store 'this' in a variable
        setTimeout(function () {
          that.acknowledgeOrResend(messageToSend);
        }, that.timeWaitForAck);
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

  /*hasReceivedMessage(message: Message): boolean {
    return (
      this.previousCRDTs.find(
        (mes) =>
          mes.fromPeerId === message.fromPeerId && mes.time === message.time
      ) != null
    );
  }*/

  getReceivedRemoteCrdts(): CRDT[] {
    return this.receivedRemotCrdts;
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
        this.broadcastInsertOrRemove(this.editorService.getCrdtsToTransfer(), true);
      } else {
        this.broadcastInsertOrRemove(this.editorService.getCrdtsToTransfer(), false);
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
  RemoteAllMessages = 4
}
