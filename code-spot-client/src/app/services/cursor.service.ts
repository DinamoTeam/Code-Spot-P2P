import { Injectable } from '@angular/core';
import { NameService } from './name.service';

@Injectable({
  providedIn: 'root',
})
export class CursorService {
  private cursorDecorations: Decoration[] = [];
  private selectionDecorations: Decoration[] = [];
  // Color: 1 to 100
  private peerColors: Map<string, number> = new Map<string, number>();
  private oldNameTags: Map<string, any> = new Map<string, any>();
  private peerNameTagIndices = new Map<string, number>();
  private myColor: number;
  private myLastCursorEvent: any = null;
  private myLastSelectEvent: any = null;
  private contentWidgetId = 0;

  constructor(private nameService: NameService) {}

  drawCursor(editor: any, line: number, col: number, ofPeerId: string) {
    const peerName = this.nameService.getPeerName(ofPeerId);
    const color = this.peerColors.get(ofPeerId);
    const deco = this.cursorDecorations.filter((d) => d.peerId === ofPeerId);
    const oldDecoration = deco.map((d) => d.decoration);
    const decoration = editor.deltaDecorations(
      oldDecoration, // Remove old deco
      [
        {
          range: new monaco.Range(line, col, line, col + 1),
          options: {
            className: 'monaco-cursor-' + color,
            stickiness: 1,
            hoverMessage: { value: peerName },
          },
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
    const peerName = this.nameService.getPeerName(ofPeerId);
    const color = this.peerColors.get(ofPeerId);
    const deco = this.selectionDecorations.filter((d) => d.peerId === ofPeerId);
    const oldDecoration = deco.map((d) => d.decoration);
    const decoration = editor.deltaDecorations(oldDecoration, [
      {
        range: new monaco.Range(startLine, startCol, endLine, endCol),
        options: {
          className: 'monaco-select-' + color,
          stickiness: 3,
          hoverMessage: { value: peerName },
        },
      },
    ]);
    this.selectionDecorations = this.selectionDecorations.filter(
      (d) => d.peerId !== ofPeerId
    );
    this.cursorDecorations.push(new Decoration(decoration, ofPeerId));
  }

  drawNameTag(
    editor: any,
    ofPeerId: string,
    newLineNumber: number,
    newColumn: number
  ) {
    const oldNameTag = this.oldNameTags.get(ofPeerId);

    if (oldNameTag) {
      editor.removeContentWidget(oldNameTag);
    }
    const nameTagOwner = this.nameService.getPeerName(ofPeerId);
    const nameTagColor = this.peerColors.get(ofPeerId);

    const contentWidgetId = this.contentWidgetId++ + '';
    const newNameTagWidget = {
      domNode: null,
      getId: function () {
        return contentWidgetId;
      },
      getDomNode: function () {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.innerHTML = nameTagOwner;
          this.domNode.style.background = 'var(--monaco-color-' + nameTagColor + ')';
          // this.domNode.className += 'disappear';
        }
        return this.domNode;
      },
      getPosition: function () {
        return {
          position: {
            lineNumber: newLineNumber,
            column: newColumn,
          },
          preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
        };
      },
    };
    editor.addContentWidget(newNameTagWidget);
    this.oldNameTags.set(ofPeerId, newNameTagWidget);

    const index = editor
      .getModel()
      .getOffsetAt(new monaco.Position(newLineNumber, newColumn));

    console.log('Just add nametag of ' + nameTagOwner + ' at index ' + index);
    this.peerNameTagIndices.set(ofPeerId, index);
  }

  nameTagIndexAfterInsert(
    originalIndex: number,
    insertStartIndex: number,
    insertLength: number
  ) {
    if (originalIndex < insertStartIndex) {
      return originalIndex;
    } else {
      return originalIndex + insertLength;
    }
  }

  nameTagIndexAfterRemove(
    originalIndex: number,
    removeStartIndex: number,
    removeLength: number
  ) {
    if (removeStartIndex >= originalIndex) {
      return originalIndex;
    } else {
      return Math.max(removeStartIndex, originalIndex - removeLength);
    }
  }

  recalculateAllNameTagIndicesAfterInsert(
    insertStartIndex: number,
    insertLength: number
  ): void {
    console.log('Calculating - startIndex: ' + insertStartIndex + ', insertLength: ' + insertLength);
    const peerIds = Array.from(this.peerNameTagIndices.keys());
    for (let i = 0; i < peerIds.length; i++) {
      const peerId = peerIds[i];
      if (!peerId) {
        console.error('PeerId undefined! What happened?!');
      }
      const oldIndex = this.peerNameTagIndices.get(peerId);
      const newIndex = this.nameTagIndexAfterInsert(
        this.peerNameTagIndices.get(peerId),
        insertStartIndex,
        insertLength
      );
      this.peerNameTagIndices.set(peerId, newIndex);
      console.log('PeerId: ' + peerId + ', oldIndex: ' + oldIndex + ', newIndex: ' + newIndex);
    }
  }

  recalculateAllNameTagIndicesAfterRemove(
    removeStartIndex: number,
    removeLength: number
  ): void {
    const peerIds = Array.from(this.peerNameTagIndices.keys());
    for (let i = 0; i < peerIds.length; i++) {
      const peerId = peerIds[i];
      if (!peerId) {
        console.error('PeerId undefined! What happened?!');
      }
      const newIndex = this.nameTagIndexAfterRemove(
        this.peerNameTagIndices.get(peerId),
        removeStartIndex,
        removeLength
      );
      this.peerNameTagIndices.set(peerId, newIndex);
    }
  }

  redrawAllNameTags(editor: any): void {
    console.log('Redrawing all name tags: ');
    console.log(this.peerNameTagIndices);
    this.peerNameTagIndices.forEach((index: number, peerId: string) => {
      const pos = editor.getModel().getPositionAt(index);
      this.drawNameTag(editor, peerId, pos.lineNumber, pos.column);
    });
  }

  setPeerColor(peerId: string, color: number): void {
    this.peerColors.set(peerId, color);
  }

  removePeer(editor: any, peerId: string): void {
    this.peerColors.delete(peerId);
    const cursorDecoration = this.cursorDecorations
      .filter((d) => d.peerId === peerId)
      .map((d) => d.decoration);
    const selectDecoration = this.cursorDecorations
      .filter((d) => d.peerId === peerId)
      .map((d) => d.decoration);
    editor.deltaDecorations(cursorDecoration, []);
    editor.deltaDecorations(selectDecoration, []);
  }

  getPeerColors(): Map<string, number> {
    return this.peerColors;
  }

  getMyCursorColor(): number {
    return this.myColor;
  }

  setMyCursorColor(color: number): void {
    this.myColor = color;
  }

  getMyLastCursorEvent(): any {
    return this.myLastCursorEvent;
  }

  setMyLastCursorEvent(event: any): void {
    this.myLastCursorEvent = event;
  }

  getMyLastSelectEvent(): any {
    return this.myLastSelectEvent;
  }

  setMyLastSelectEvent(event: any): void {
    this.myLastSelectEvent = event;
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
