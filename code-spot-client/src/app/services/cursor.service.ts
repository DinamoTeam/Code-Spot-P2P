import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CursorService {
  private cursorDecorations: Decoration[] = [];
  private selectionDecorations: Decoration[] = [];

  drawCursor(editor: any, line: number, col: number, ofPeerId: string) {
    const deco = this.cursorDecorations.filter((d) => d.peerId === ofPeerId);
    const oldDecoration = deco.map((d) => d.decoration);
    const decoration = editor.deltaDecorations(
      oldDecoration, // Remove old deco
      [
        {
          range: new monaco.Range(line, col, line, col + 1),
          options: { className: 'monaco-cursor', stickiness: 1 },
        },
      ]
    );
    this.cursorDecorations = this.cursorDecorations.filter(
      (d) => d.peerId !== ofPeerId
    );
    this.cursorDecorations.push(new Decoration(decoration, ofPeerId));
  }

  drawSelection(
    editor: any,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    ofPeerId: string
  ) {
    const deco = this.selectionDecorations.filter((d) => d.peerId === ofPeerId);
    const oldDecoration = deco.map((d) => d.decoration);
    const decoration = editor.deltaDecorations(oldDecoration, [
      {
        range: new monaco.Range(startLine, startCol, endLine, endCol),
        options: { className: 'monaco-select', stickiness: 1 },
      },
    ]);
    this.selectionDecorations = this.selectionDecorations.filter(
      (d) => d.peerId !== ofPeerId
    );
    this.cursorDecorations.push(new Decoration(decoration, ofPeerId));
  }
}

class Decoration {
  decoration: any;
  peerId: string;
  constructor(decoration: any, peerId: string) {
    this.decoration = decoration;
    this.peerId = peerId;
  }
}
