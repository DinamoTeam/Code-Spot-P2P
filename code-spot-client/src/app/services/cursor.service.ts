import { Injectable } from '@angular/core';
import { NameService } from './name.service';

@Injectable({
  providedIn: 'root',
})
export class CursorService {
  private selectionDecorations: Decoration[] = [];
  // Color: 1 to 25. peerColors include myColor
  private peerColors: Map<string, number> = new Map<string, number>();
  private oldNameTags: Map<string, any> = new Map<string, any>();
  private oldCursors: Map<string, any> = new Map<string, any>();
  private otherPeerNameTagAndCursorIndices = new Map<string, number>();
  private myNameTagIndex: number;
  private myPeerId: string;
  private myLastCursorEvent: any = null;
  private myLastSelectEvent: any = null;
  private peerMostRecentCursorEvents = new Map<string, any>();
  private peerMostRecentSelectEvents = new Map<string, any>();
  private contentWidgetId = 0;
  private showNameTag = true;
  justJoinRoom = true;

  constructor(private nameService: NameService) {}

  drawSelection(
    editor: any,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    ofPeerId: string
  ) {
    const color = this.peerColors.get(ofPeerId);
    const deco = this.selectionDecorations.filter((d) => d.peerId === ofPeerId);
    const oldDecoration = deco.map((d) => d.decoration);
    const decoration = editor.deltaDecorations(oldDecoration, [
      {
        range: new monaco.Range(startLine, startCol, endLine, endCol),
        options: {
          className: 'monaco-select-' + color,
          stickiness: 1,
        },
      },
    ]);
    this.selectionDecorations = this.selectionDecorations.filter(
      (d) => d.peerId !== ofPeerId
    );
    this.selectionDecorations.push(new Decoration(decoration, ofPeerId));
  }

  drawCursor(
    editor: any,
    ofPeerId: string,
    newLineNumber: number,
    newColumn: number
  ) {
    const oldCursor = this.oldCursors.get(ofPeerId);

    if (oldCursor) {
      editor.removeContentWidget(oldCursor);
    }
    const cursorColor = this.peerColors.get(ofPeerId);

    const contentWidgetId = this.contentWidgetId++ + '';
    const newCursorWidget = {
      domNode: null,
      getId: function () {
        return contentWidgetId;
      },
      getDomNode: function () {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.classList.add('monaco-cursor-' + cursorColor);
        }
        return this.domNode;
      },
      getPosition: function () {
        return {
          position: {
            lineNumber: newLineNumber,
            column: newColumn,
          },
          preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
        };
      },
    };
    editor.addContentWidget(newCursorWidget);
    this.oldCursors.set(ofPeerId, newCursorWidget);

    const index = editor
      .getModel()
      .getOffsetAt(new monaco.Position(newLineNumber, newColumn));
    this.otherPeerNameTagAndCursorIndices.set(ofPeerId, index);
  }

  drawNameTag(
    editor: any,
    ofPeerId: string,
    newLineNumber: number,
    newColumn: number,
    isMyNameTag: boolean
  ) {
    const oldNameTag = this.oldNameTags.get(ofPeerId);

    if (oldNameTag) {
      editor.removeContentWidget(oldNameTag);
    }
    const nameTagOwner = this.nameService.getPeerName(ofPeerId);
    const nameTagColor = this.peerColors.get(ofPeerId);

    const contentWidgetId = this.contentWidgetId++ + '';
    const showTag = this.showNameTag;
    const newNameTagWidget = {
      domNode: null,
      getId: function () {
        return contentWidgetId;
      },
      getDomNode: function () {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.textContent = nameTagOwner;
          this.domNode.style.whiteSpace = 'nowrap';
          this.domNode.style.background =
            'var(--monaco-color-' + nameTagColor + ')';
          this.domNode.classList.add('nameTagText');
          if (!showTag) {
            this.domNode.classList.add('hide');
          }
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
    if (!isMyNameTag) {
      this.otherPeerNameTagAndCursorIndices.set(ofPeerId, index);
    } else {
      this.myNameTagIndex = index;
    }
  }

  hideAllNameTags() {
    const nameTags = Array.from(this.oldNameTags.values());
    for (let i = 0; i < nameTags.length; i++) {
      const nameTag = nameTags[i];
      nameTag.domNode.classList.add('hide');
    }
    this.showNameTag = false;
  }

  showAllNameTags() {
    const nameTags = Array.from(this.oldNameTags.values());
    for (let i = 0; i < nameTags.length; i++) {
      const nameTag = nameTags[i];
      nameTag.domNode.classList.remove('hide');
    }
    this.showNameTag = true;
  }

  /**
   * Manually calculate where nameTag and cursor should be after an insertion
   */
  nameTagAndCursorIndexAfterInsert(
    originalIndex: number,
    insertStartIndex: number,
    insertLength: number,
    moveNameTagOrCursorWhenInsertAtRightEdge: boolean
  ) {
    if (originalIndex < insertStartIndex) {
      return originalIndex;
    } else if (originalIndex === insertStartIndex) {
      if (moveNameTagOrCursorWhenInsertAtRightEdge) {
        return originalIndex + insertLength;
      } else {
        return originalIndex;
      }
    } else {
      return originalIndex + insertLength;
    }
  }

  /**
   * Manually calculate where nameTag and cursor should be after a removal
   */
  nameTagAndCursorIndexAfterRemove(
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

  recalculateAllNameTagAndCursorIndicesAfterInsert(
    insertStartIndex: number,
    insertLength: number,
    peerIdWhoMadeThisInsertion: string
  ): void {
    // Recalculate peers' nameTag and cursor indices
    const peerIds = Array.from(this.otherPeerNameTagAndCursorIndices.keys());
    for (let i = 0; i < peerIds.length; i++) {
      const peerId = peerIds[i];
      const isThisPeerMadeThisInsertion = peerId === peerIdWhoMadeThisInsertion;
      const newIndex = this.nameTagAndCursorIndexAfterInsert(
        this.otherPeerNameTagAndCursorIndices.get(peerId),
        insertStartIndex,
        insertLength,
        isThisPeerMadeThisInsertion
      );
      this.otherPeerNameTagAndCursorIndices.set(peerId, newIndex);
    }

    // Recalculate my nameTag and cursor index
    const iMadeThisInsert = peerIdWhoMadeThisInsertion === this.myPeerId;
    const myNewIndex = this.nameTagAndCursorIndexAfterInsert(
      this.myNameTagIndex,
      insertStartIndex,
      insertLength,
      iMadeThisInsert
    );
    this.myNameTagIndex = myNewIndex;
  }

  recalculateAllNameTagAndCursorIndicesAfterRemove(
    removeStartIndex: number,
    removeLength: number
  ): void {
    // Recalculate peers' nameTag and cursor indices
    const peerIds = Array.from(this.otherPeerNameTagAndCursorIndices.keys());
    for (let i = 0; i < peerIds.length; i++) {
      const peerId = peerIds[i];
      const newIndex = this.nameTagAndCursorIndexAfterRemove(
        this.otherPeerNameTagAndCursorIndices.get(peerId),
        removeStartIndex,
        removeLength
      );
      this.otherPeerNameTagAndCursorIndices.set(peerId, newIndex);
    }

    // Recalculate my nameTag index
    const myNewIndex = this.nameTagAndCursorIndexAfterRemove(
      this.myNameTagIndex,
      removeStartIndex,
      removeLength
    );
    this.myNameTagIndex = myNewIndex;
  }

  redrawPeersNameTagsAndCursors(editor: any): void {
    this.otherPeerNameTagAndCursorIndices.forEach(
      (index: number, peerId: string) => {
        const pos = editor.getModel().getPositionAt(index);
        this.drawNameTag(editor, peerId, pos.lineNumber, pos.column, false);
        this.drawCursor(editor, peerId, pos.lineNumber, pos.column);
      }
    );
  }

  redrawMyNameTag(editor: any, myPeerId: string): void {
    const pos = editor.getModel().getPositionAt(this.myNameTagIndex);
    this.drawNameTag(editor, myPeerId, pos.lineNumber, pos.column, true);
  }

  setPeerColor(peerId: string, color: number): void {
    this.peerColors.set(peerId, color);
  }

  removePeer(editor: any, peerId: string): void {
    this.peerColors.delete(peerId);

    // Clean select decoration
    const selectDecoration = this.selectionDecorations
      .filter((d) => d.peerId === peerId)
      .map((d) => d.decoration);
    editor.deltaDecorations(selectDecoration, []);

    // Clean name tag
    const oldNameTag = this.oldNameTags.get(peerId);
    if (oldNameTag) {
      editor.removeContentWidget(oldNameTag);
      this.oldNameTags.delete(peerId);
      this.otherPeerNameTagAndCursorIndices.delete(peerId);
    }

    // Clean cursor
    const oldCursor = this.oldCursors.get(peerId);
    if (oldCursor) {
      editor.removeContentWidget(oldCursor);
      this.oldCursors.delete(peerId);
      this.otherPeerNameTagAndCursorIndices.delete(peerId);
    }
  }

  getPeerColor(peerId: string): number {
    return this.peerColors.get(peerId);
  }

  getMyCursorColor(): number {
    return this.peerColors.get(this.myPeerId);
  }

  setMyCursorColorAndPeerId(myPeerId: string, color: number): void {
    this.setPeerColor(myPeerId, color);
    this.myPeerId = myPeerId;
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

  getPeerMostRecentCursorEvent(peerId: string): any {
    return this.peerMostRecentCursorEvents.get(peerId);
  }

  setPeerMostRecentCursorChange(peerId: string, event: any) {
    this.peerMostRecentCursorEvents.set(peerId, event);
  }

  getPeerMostRecentSelectEvent(peerId: string): any {
    return this.peerMostRecentSelectEvents.get(peerId);
  }

  setPeerMostRecentSelectEvent(peerId: string, event: any) {
    this.peerMostRecentSelectEvents.set(peerId, event);
  }
}

/**
 * Wrap Monaco's decoration (add peerId)
 */
class Decoration {
  decoration: any;
  peerId: string;
  constructor(decoration: any, peerId: string) {
    this.decoration = decoration;
    this.peerId = peerId;
  }
}
