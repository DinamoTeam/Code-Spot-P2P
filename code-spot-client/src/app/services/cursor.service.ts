import { Injectable } from '@angular/core';



@Injectable({
  providedIn: 'root',
})
export class CursorService {
  private cursorDecorations: Decoration[] = [];
  private selectionDecorations: Decoration[] = [];

  drawCursor(editor: any, line: number, col: number, ofPeerId: string) {
    console.log('i am here');
    const deco = this.cursorDecorations.filter(d => d.peerId === ofPeerId);
    const oldDecoration = deco.map(d => d.decoration);
    console.log(oldDecoration);
    const decoration = editor.deltaDecorations(
      oldDecoration, // Remove old deco
      [
        {
          range: new monaco.Range(line, col, line, col + 1),
          options: { className: 'monaco-cursor', stickiness: 1},
        },
      ]
    );
    this.cursorDecorations = this.cursorDecorations.filter(d => d.peerId !== ofPeerId);
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