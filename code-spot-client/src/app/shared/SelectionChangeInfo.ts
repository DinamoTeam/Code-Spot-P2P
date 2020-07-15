export class SelectionChangeInfo {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  peerId: string;
  constructor(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    peerId: string
  ) {
    this.startLine = startLine;
    this.startColumn = startCol;
    this.endLine = endLine;
    this.endColumn = endCol;
    this.peerId = peerId;
  }
}
