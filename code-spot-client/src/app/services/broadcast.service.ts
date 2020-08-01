import { Injectable } from '@angular/core';
import { Message, MessageType } from '../shared/Message';
import { EditorService } from './editor.service';
import { CRDT } from '../shared/CRDT';
import { CrdtUtils } from '../shared/Utils';
import { CursorService } from './cursor.service';

@Injectable({
  providedIn: 'root',
})
export class BroadcastService {
  private peer: any;
  private chatMessageTime = 0;
  static readonly CRDTDelimiter = '#$'; // Has to be at least 2 unique chars

  constructor(private cursorService: CursorService) {}

  /**
   * Use when first join room to ask a peer to send us oldCRDTs, old chat messages
   */
  requestOldMessages(conn: any, messageType: MessageType) {
    const message = new Message(null, messageType, this.peer.id);
    conn.send(message);
  }

  sendOldCRDTs(conn: any, previousCRDTs: CRDT[]) {
    previousCRDTs = previousCRDTs.slice(1, previousCRDTs.length - 1); // Don't send "beg" and "end" CRDT
    if (previousCRDTs.length === 0) {
      conn.send(new Message('', MessageType.OldCRDTsLastBatch, this.peer.id));
      return;
    }

    // WebRTC has max message size (different for each browser), ranging from 16Kb to 256Kb.
    // Our CRDTs can be large. Therefore we need to break them in small batches
    const crdtStrings = CrdtUtils.breakCrdtsIntoCrdtStringBatches(
      previousCRDTs,
      BroadcastService.CRDTDelimiter
    );

    for (let i = 0; i < crdtStrings.length; i++) {
      const messageType =
        i === crdtStrings.length - 1
          ? MessageType.OldCRDTsLastBatch
          : MessageType.OldCRDTs;
      const message = new Message(crdtStrings[i], messageType, this.peer.id);
      conn.send(message); // Send each batch
    }

    // Without setTimeout, cursor isn't update. Why?!
    const that = this;
    setTimeout(() => that.sendCursorInfo(conn), 10);
  }

  sendOldMessages(conn: any, previousChatMessages: Message[]) {
    const message = new Message(
      JSON.stringify(previousChatMessages),
      MessageType.OldChatMessages,
      this.peer.id
    );
    conn.send(message);
  }

  /**
   * Send old chat messages, old crdts and most recent change language
   */
  sendOldData(conn: any, oldChatMessages: Message[], oldCRDTs: CRDT[]) {
    this.sendOldCRDTs(conn, oldCRDTs);
    this.sendOldMessages(conn, oldChatMessages);
    this.sendChangeLanguage(conn);
  }

  sendMyCursorColor(conn: any, myColor: number) {
    conn.send(new Message(myColor + '', MessageType.CursorColor, this.peer.id));
  }

  /**
   * Is called when our user insert / remove something. These changes will be
   * converted to corresponding CRDT objects and broadcasted to the rest in room
   * See editor.service.ts - handle local insert / remove for more details.
   */
  broadcastInsertOrRemove(
    crdts: CRDT[],
    isInsert: boolean,
    connectionList: any[]
  ) {
    const messageType = isInsert
      ? MessageType.RemoteInsert
      : MessageType.RemoteRemove;

    const crdtStrings = CrdtUtils.breakCrdtsIntoCrdtStringBatches(
      crdts,
      BroadcastService.CRDTDelimiter
    );

    for (let i = 0; i < crdtStrings.length; i++) {
      connectionList.forEach((conn) => {
        const messageToSend = new Message(
          crdtStrings[i],
          messageType,
          this.peer.id
        );
        conn.send(messageToSend);
      });
    }
  }

  broadcastMessageToNewPeers(message: Message, conns: any[]) {
    conns.forEach((connection) => {
      connection.send(message);
    });
  }

  broadcastChatMessage(
    content: string,
    connectionList: any[],
    previousChatMessages: Message[]
  ) {
    if (content.length === 0) {
      return;
    }

    previousChatMessages.push(
      new Message(
        content,
        MessageType.ChatMessage,
        this.peer.id,
        this.chatMessageTime
      )
    );

    connectionList.forEach((conn) => {
      const messageToSend = new Message(
        content,
        MessageType.ChatMessage,
        this.peer.id,
        this.chatMessageTime
      );

      conn.send(messageToSend);
    });

    // A chat message is uniquely identified by fromPeerId and chatMessageTime.
    // We use this to avoid duplicate chat messages
    this.chatMessageTime++;
  }

  broadcastChangeLanguage(connectionList: any[]) {
    connectionList.forEach((conn) => {
      this.sendChangeLanguage(conn);
    });
  }

  sendChangeLanguage(conn: any) {
    const messageToSend = new Message(
      EditorService.currentLanguage,
      MessageType.ChangeLanguage,
      this.peer.id
    );
    conn.send(messageToSend);
  }

  broadcastChangeName(connectionList: any[], newName: string) {
    connectionList.forEach((conn) => {
      this.sendChangeName(conn, newName);
    });
  }

  sendChangeName(conn: any, newName: string) {
    const messageToSend = new Message(
      newName,
      MessageType.ChangeName,
      this.peer.id
    );
    conn.send(messageToSend);
  }

  broadcastChangeSelectionPos(event: any, connectionList: any[]) {
    connectionList.forEach((conn) => {
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

  broadcastChangeCursorPos(event: any, connectionList: any[]): void {
    connectionList.forEach((conn) => {
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

  sendNameAndCursorInfo(conn: any, name: string): void {
    // Order is important! Name first and then cursor info!
    this.sendMyName(conn, name);
    this.sendCursorInfo(conn);
  }

  /**
   * Send our cursor color, cursor pos and selection pos
   */
  sendCursorInfo(conn: any): void {
    this.sendMyCursorColor(conn, this.cursorService.getMyCursorColor());

    const lastCursorEvent = this.cursorService.getMyLastCursorEvent();
    if (lastCursorEvent !== null) {
      this.sendChangeCursorPos(conn, lastCursorEvent);
    }

    const lastSelectEvent = this.cursorService.getMyLastSelectEvent();
    if (lastSelectEvent !== null) {
      this.sendChangeSelectionPos(conn, lastSelectEvent);
    }
  }

  sendMyName(conn: any, myName: string): void {
    const message = new Message(myName, MessageType.Name, this.peer.id);
    conn.send(message);
  }

  tellPeerCannotSendOldData(conn: any) {
    conn.send(
      new Message(
        null,
        MessageType.CannotSendOldCRDTsOrOldChatMessages,
        this.peer.id
      )
    );
  }

  /**
   * Get our peer object from peerService
   */
  setPeer(peer: any) {
    this.peer = peer;
  }
}
