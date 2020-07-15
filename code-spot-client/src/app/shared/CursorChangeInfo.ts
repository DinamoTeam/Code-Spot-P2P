export class CursorChangeInfo {
  line: number;
  col: number;
  peerId: string;
  constructor(line: number, col: number, peerId: string) {
    this.line = line;
    this.col = col;
    this.peerId = peerId;
  }
}