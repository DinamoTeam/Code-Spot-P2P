import { EventEmitter, Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { BalancedBST } from '../shared/BalancedBST';
import { CursorService } from './cursor.service';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static language: string = 'cpp';
  static siteId: number = -1;
  static remoteOpLeft: number = 0;
  curClock: number = 0;
  bst: BalancedBST<CRDT>;
  crdtEvent = new EventEmitter<boolean>();
  crdtsToTransfer: CRDT[];

  static setSiteId(id: number): void {
    EditorService.siteId = id;
  }

  constructor(private cursorService: CursorService) {
    this.bst = new BalancedBST<CRDT>();
    this.bst.insert(
      new CRDT('_beg', new CRDTId([new Identifier(1, 0)], this.curClock++))
    );
    this.bst.insert(
      new CRDT(
        '_end',
        new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], this.curClock++)
      )
    );
  }

  handleLocalRangeInsert(
    auxEditorTextModel: any,
    newText: string,
    startLineNumber: number,
    startColumn: number
  ): void {
    if (EditorService.siteId === -1)
      throw new Error('Error: call handleLocalInsert before setting siteId');

    if (newText === '') return;

    // IMPORTANT: Update auxiliary editor ONLY AFTER getting the CORRECT startIndex
    const startIndex =
      this.posToIndex(auxEditorTextModel, startLineNumber, startColumn) + 1; // Because we have __beg limit
    this.writeRangeOfTextToScreenAtPos(
      auxEditorTextModel,
      newText,
      startLineNumber,
      startColumn
    );

    const chArr = newText.split('');

    const crdtIdBefore = this.bst.getDataAt(startIndex - 1).id;
    const crdtIdAfter = this.bst.getDataAt(startIndex).id;
    const listCrdtIdsBetween = CRDTId.generateNPositionsBetween(
      crdtIdBefore,
      crdtIdAfter,
      chArr.length,
      EditorService.siteId,
      this.curClock
    );

    this.curClock += chArr.length; // Generate N new CRDTIds therefore increment curClock by N

    let chArrIndex = 0;
    const listCRDTBetween = listCrdtIdsBetween.map(
      (crdtId) => new CRDT(chArr[chArrIndex++], crdtId)
    );

    for (let i = 0; i < listCRDTBetween.length; i++) {
      this.bst.insert(listCRDTBetween[i]);
    }

    this.crdtsToTransfer = listCRDTBetween;
    this.crdtEvent.emit(true);
  }

  handleRemoteRangeInsert(
    editor: any,
    editorTextModel: any,
    auxEditorTextModel: any,
    crdts: CRDT[]
  ) {
    const insertingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const insertingIndex = this.bst.insert(crdts[i]);
      if (insertingIndex === -1) insertingIndices[i] = -1;
      else insertingIndices[i] = insertingIndex - 1; // Because of __beg limit
    }

    const actuallyInsertingChars: string[] = [];
    for (let i = 0; i < crdts.length; i++) {
      if (insertingIndices[i] !== -1) {
        actuallyInsertingChars.push(crdts[i].ch);
      }
    }
    const actuallyInsertingIndices = insertingIndices.filter(
      (index) => index !== -1
    );

    // Write continuous ranges of text to screen
    let i = 0;
    let startIndexMonaco = -1;
    let endIndexMonaco = -1;
    while (i < actuallyInsertingIndices.length) {
      // Find continuous ranges of text
      startIndexMonaco = actuallyInsertingIndices[i];
      let j = i + 1;
      while (j < actuallyInsertingIndices.length && actuallyInsertingIndices[j] === actuallyInsertingIndices[j - 1] + 1) {
        j++;
      }
      endIndexMonaco = actuallyInsertingIndices[j - 1];
      i = j;

      // Get text to be inserted
      const numElements = endIndexMonaco - startIndexMonaco + 1;
      const endIndexArrInclusive = i - 1;
      const startIndexArr = endIndexArrInclusive - numElements + 1;
      const textToInsert = actuallyInsertingChars
        .slice(startIndexArr, endIndexArrInclusive + 1)
        .join('');

      if (
        actuallyInsertingChars[startIndexArr] === ' ' ||
        actuallyInsertingChars[startIndexArr] === '\n' ||
        actuallyInsertingChars.length > 10
      ) {
        editorTextModel.pushStackElement();
      }

      // Insert to the screen
      EditorService.remoteOpLeft++; // Avoid triggering monaco change event

      // main Editor
      this.writeRangeOfTextToScreenAtIndex(
        editorTextModel,
        textToInsert,
        startIndexMonaco
      );

      // Calculate new pos for nameTag after remote insert
      this.cursorService.recalculateAllNameTagIndicesAfterInsert(startIndexMonaco, textToInsert.length);

      // aux Editor
      this.writeRangeOfTextToScreenAtIndex(
        auxEditorTextModel,
        textToInsert,
        startIndexMonaco
      );
    }

    // Actually redraw nameTag
    this.cursorService.redrawAllNameTags(editor);
  }

  handleLocalRangeRemove(
    auxEditorTextModel: any,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
    length: number
  ): void {
    if (EditorService.siteId === -1)
      throw new Error('Error: call handleLocalRemove before setting siteId');

    if (length === 0) return;

    // IMPORTANT: Update auxiliary editor ONLY AFTER getting the CORRECT startIndex
    const startIndex =
      this.posToIndex(auxEditorTextModel, startLineNumber, startColumn) + 1; // Because we have __beg limit
    this.deleteTextInRangePos(
      auxEditorTextModel,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn
    );

    const removedCRDTs: CRDT[] = [];
    for (let i = 0; i < length; i++) {
      const crdtToBeRemoved = this.bst.getDataAt(startIndex);
      removedCRDTs.push(crdtToBeRemoved);
      this.bst.remove(crdtToBeRemoved);
    }

    this.crdtsToTransfer = removedCRDTs;
    this.crdtEvent.emit(false);
  }

  handleRemoteRangeRemove(
    editor: any,
    editorTextModel: any,
    auxEditorTextModel: any,
    crdts: CRDT[]
  ): void {
    const deletingIndices = new Array<number>(crdts.length);
    let offSet = 0; // offSet to add back to index because deleting 1 element will decrease the indices of all elements after it
    for (let i = 0; i < crdts.length; i++) {
      const deletingIndex = this.bst.remove(crdts[i]);
      if (deletingIndex === -1) deletingIndices[i] = -1;
      else {
        deletingIndices[i] = deletingIndex - 1 + offSet; // -1 Because of __beg limit
        offSet++;
      }
    }

    const actuallyDeletingIndices = deletingIndices.filter(
      (index) => index !== -1
    );

    console.log(actuallyDeletingIndices);

    // Delete continuous ranges of text from the screen
    let i = actuallyDeletingIndices.length - 1; // Delete backwards
    let startIndexMonaco = -1;
    let endIndexMonaco = -1;
    while (i >= 0) {

      endIndexMonaco = actuallyDeletingIndices[i];
      let j = i - 1;
      while (j >= 0 && actuallyDeletingIndices[j] + 1 === actuallyDeletingIndices[j + 1]) {
        j--;
      }
      startIndexMonaco = actuallyDeletingIndices[j + 1];
      i = j;

      // Delete from the screen
      EditorService.remoteOpLeft++; // Avoid triggering monaco change event

      // main Editor
      this.deleteTextInRangeIndex(
        editorTextModel,
        startIndexMonaco,
        endIndexMonaco + 1
      );

      // Calculate new pos for nameTag after remote remove
      const deleteLength = endIndexMonaco - startIndexMonaco + 1;
      this.cursorService.recalculateAllNameTagIndicesAfterRemove(startIndexMonaco, deleteLength);

      // aux Editor
      this.deleteTextInRangeIndex(
        auxEditorTextModel,
        startIndexMonaco,
        endIndexMonaco + 1
      );
    }

    // Actually redraw nameTag
    this.cursorService.redrawAllNameTags(editor);
  }

  getOldCRDTsAsSortedArray(): CRDT[] {
    return this.bst.toSortedArray();
  }

  getCrdtsToTransfer() {
    return this.crdtsToTransfer;
  }

  private writeRangeOfTextToScreenAtIndex(
    editorTextModel: any,
    text: string,
    index: number
  ): void {
    const pos = this.indexToPos(editorTextModel, index);
    this.writeRangeOfTextToScreenAtPos(
      editorTextModel,
      text,
      pos.lineNumber,
      pos.column
    );
  }

  private deleteTextInRangeIndex(
    editorTextModel: any,
    startIndex: number,
    endIndex: number
  ): void {
    const startPos = this.indexToPos(editorTextModel, startIndex);
    const endPos = this.indexToPos(editorTextModel, endIndex);
    this.deleteTextInRangePos(
      editorTextModel,
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    );
  }

  private deleteTextInRangePos(
    editorTextModel: any,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ): void {
    const range = new monaco.Range(
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn
    );
    editorTextModel.pushEditOperations(
      [],
      [
        {
          range: range,
          text: null,
        },
      ]
    );
  }

  private writeRangeOfTextToScreenAtPos(
    editorTextModel: any,
    text: string,
    startLineNumber: number,
    startColumn: number
  ) {
    const range = new monaco.Range(
      startLineNumber,
      startColumn,
      startLineNumber,
      startColumn
    );

    editorTextModel.pushEditOperations(
      [],
      [
        {
          range: range,
          text: text,
          forceMoveMarkers: true
        },
      ]
    );
  }

  posToIndex(
    editorTextModel: any,
    endLineNumber: number,
    endColumn: number
  ): number {
    return editorTextModel.getOffsetAt(
      new monaco.Position(endLineNumber, endColumn)
    );
  }

  indexToPos(editorTextModel: any, index: number): any {
    return editorTextModel.getPositionAt(index);
  }
}
