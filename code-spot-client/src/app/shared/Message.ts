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
  RemoteInsert,
  RemoteRemove,
  OldCRDTs,
  OldCRDTsLastBatch,
  RequestOldCRDTsAndChatMessages,
  Acknowledge,
  ChangeLanguage,
  CannotSendOldCRDTsOrOldChatMessages,
  ChatMessage,
  OldChatMessages,
  RequestOldChatMessages,
  CannotSendOldChatMessages,
  ChangeCursor,
  ChangeSelect,
  CursorColor,
  Name,
  CanDisplayMeJustJoinRoom,
  ChangeName,
}
