export class EnterRoomInfo {
  siteId: number;
  roomName: string;
  peerIds: string[];
  hasReceivedAllMessages: number[];
  cursorColors: number[];
  cursorColor: number;
}