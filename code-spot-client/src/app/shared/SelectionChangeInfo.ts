export class SelectionChangeInfo {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  peerId: string;
  source: any;
  reason: any;
  constructor(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    peerId: string,
    source: any,
    reason: any
  ) {
    this.startLine = startLine;
    this.startColumn = startCol;
    this.endLine = endLine;
    this.endColumn = endCol;
    this.peerId = peerId;
    this.source = source;
    this.reason = reason;
  }
}
