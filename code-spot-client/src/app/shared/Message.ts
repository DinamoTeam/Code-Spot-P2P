export class Message {
  content: string;
  messageType: MessageType;
  fromPeerId: string;
  toPeerId: string;
  time: number;
  constructor(
    content: string,
    messageType: MessageType,
    fromPeerId: string,
    toPeerId: string,
    time: number
  ) {
    this.content = content;
    this.messageType = messageType;
    this.fromPeerId = fromPeerId;
    this.toPeerId = toPeerId;
    this.time = time;
  }

  toString(): string {
    return 'Time: ' + this.time;
  }
}

export const enum MessageType {
  RemoteInsert = 0,
  RemoteRemove = 1,
  OldCRDTs = 2,
  OldCRDTsLastBatch = 3,
  RequestOldCRDTs = 4,
  Acknowledge = 5,
  ChangeLanguage = 6,
  CannotSendOldCRDTs = 7,
  ChatMessage = 8
}
