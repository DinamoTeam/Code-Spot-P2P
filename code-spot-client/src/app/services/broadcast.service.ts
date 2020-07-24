import { Injectable } from '@angular/core';
import { Message, MessageType } from '../shared/Message';
import { NameService } from './name.service';
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
  private readonly CRDTDelimiter = '#$'; // Has to be at least 2 unique chars

  constructor(
    private nameService: NameService,
    private editorService: EditorService,
    private cursorService: CursorService
  ) {}

  requestOldMessages(conn: any, messageType: MessageType) {
    const message = new Message(null, messageType, this.peer.id);
    conn.send(message);
  }

  sendOldCRDTs(conn: any) {
    let previousCRDTs: CRDT[] = this.editorService.getOldCRDTsAsSortedArray();
    previousCRDTs = previousCRDTs.slice(1, previousCRDTs.length - 1); // Don't send "beg" and "end" CRDT
    if (previousCRDTs.length === 0) {
      conn.send(new Message('', MessageType.OldCRDTsLastBatch, this.peer.id));
      return;
    }

    const crdtStrings = CrdtUtils.breakCrdtsIntoCrdtStringBatches(
      previousCRDTs,
      this.CRDTDelimiter
    );

    for (let i = 0; i < crdtStrings.length; i++) {
      const messageType =
        i === crdtStrings.length - 1
          ? MessageType.OldCRDTsLastBatch
          : MessageType.OldCRDTs;
      const message = new Message(crdtStrings[i], messageType, this.peer.id);
      conn.send(message);
    }

    const that = this;
    setTimeout(() => that.sendCursorInfo(conn), 10); // WHY SET TIME OUT MAKE IT WORK???!!!!@@$!$!$
  }

  sendOldMessages(conn: any, previousChatMessages: Message[]) {
    const message = new Message(
      JSON.stringify(previousChatMessages),
      MessageType.OldChatMessages,
      this.peer.id
    );
    conn.send(message);
  }

  sendMyCursorColor(conn: any, myColor: number) {
    conn.send(new Message(myColor + '', MessageType.CursorColor, this.peer.id));
  }

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
      this.CRDTDelimiter
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

  broadcastNewMessagesToConnUntil(
    conn: any,
    milliSecondsLater: number,
    connsToBroadcast: any[]
  ) {
    connsToBroadcast.push(conn);
    const that = this;
    setTimeout(function () {
      connsToBroadcast = connsToBroadcast.filter(
        (connection) => connection.peer !== conn.peer
      );
    }, milliSecondsLater);
  }

  broadcastMessageToNewPeers(message: Message, conns: any[]) {
    conns.forEach((connection) => {
      connection.send(message);
    });
  }

  sendMessage(content: string, connectionList: any[], previousChatMessages: Message[]) {
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
    this.chatMessageTime++;
  }

  broadcastChangeLanguage(connectionList: any[]) {
    connectionList.forEach((conn) => {
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

  /* Cursor Change + Selection Change*/
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

  setPeer(peer: any) {
    this.peer = peer;
  }
}
