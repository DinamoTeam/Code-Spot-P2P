export class CursorChangeInfo {
  line: number;
  col: number;
  peerId: string;
  source: any;
  reason: any;
  constructor(line: number, col: number, peerId: string, source: any, reason: any) {
    this.line = line;
    this.col = col;
    this.peerId = peerId;
    this.source = source;
    this.reason = reason;
  }
}