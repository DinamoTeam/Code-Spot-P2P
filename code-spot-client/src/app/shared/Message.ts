export class Message {
  content: any;
  messageType: MessageType;
  fromPeerId: string;
  chatMessageTime: number;
  crdtBatchNumber: number;
  totalCrdtBatches: number;
  constructor(
    content: any,
    messageType: MessageType,
    fromPeerId: string,
    chatMessageTime?: number
  ) {
    this.content = content;
    this.messageType = messageType;
    this.fromPeerId = fromPeerId;
    this.chatMessageTime = chatMessageTime;
  }
}

export const enum MessageType {
  RemoteInsert = 0,
  RemoteRemove = 1,
  OldCRDTs = 2,
  OldCRDTsLastBatch = 3,
  RequestOldCRDTsAndChatMessages = 4,
  Acknowledge = 5,
  ChangeLanguage = 6,
  CannotSendOldCRDTsOrOldChatMessages = 7,
  ChatMessage = 8,
  OldChatMessages = 9,
  RequestOldChatMessages = 10,
  CannotSendOldChatMessages = 11,
  ChangeCursor = 12,
  ChangeSelect = 13,
  CursorColor = 14,
  Name = 15,
  CanDisplayMeJustJoinRoom = 16,
  ChangeName = 17,
}
