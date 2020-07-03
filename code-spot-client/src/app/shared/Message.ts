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
    return "Time: " + this.time;
  }
}

export const enum MessageType {
  Message = 0,
  AllMessages = 1,
  RequestAllMessages = 2,
  Acknowledge = 3,
}
