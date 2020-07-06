import { EventEmitter, Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { BalancedBST } from '../shared/BalancedBST';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static siteId: number = -1;
  static remoteOpLeft: number = 0;
  curClock: number = 0;
  bst: BalancedBST<CRDT>;
  crdtEvent = new EventEmitter<boolean>();
  crdtsToTransfer: CRDT[];

  static setSiteId(id: number): void {
    EditorService.siteId = id;
  }

  constructor() {
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
    editorTextModel: any,
    auxEditorTextModel: any,
    crdts: CRDT[],
    isAllMessages = false
  ) {
    if (isAllMessages) {
      crdts.sort((crdt1, crdt2) => crdt1.compareTo(crdt2)); // Sort by ascending order
    }
    console.log('Receive remote range insert');
    console.log(crdts);
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
      endIndexMonaco = startIndexMonaco;
      while (i < actuallyInsertingIndices.length) {
        if (
          endIndexMonaco !== startIndexMonaco &&
          actuallyInsertingIndices[i] !== actuallyInsertingIndices[i - 1] + 1
        ) {
          i++;
          break;
        }
        endIndexMonaco = actuallyInsertingIndices[i];
        i++;
      }
      // Get text to be inserted
      const numElements = endIndexMonaco - startIndexMonaco + 1;
      const endIndexArr = i - 1;
      const startIndexArr = endIndexArr - numElements + 1;
      const textToInsert = actuallyInsertingChars
        .slice(startIndexArr, endIndexArr + 1)
        .join('');

      if (
        actuallyInsertingChars[startIndexArr] === ' ' ||
        actuallyInsertingChars[startIndexArr] === '\n' ||
        actuallyInsertingChars.length > 10
      ) {
        editorTextModel.pushStackElement();
      }
      // Write to screen
      EditorService.remoteOpLeft++; // Avoid triggering monaco change event
      this.writeRangeOfTextToScreenAtIndex(
        editorTextModel,
        textToInsert,
        startIndexMonaco
      );

      // aux Editor
      this.writeRangeOfTextToScreenAtIndex(
        auxEditorTextModel,
        textToInsert,
        startIndexMonaco
      );
    }

    /*// Right now: Naively insert each char for testing purposes
    const insertingChar = crdts.map((crdt) => crdt.ch);
    for (let i = 0; i < crdts.length; i++) {
      // Only insert not existed element
      if (insertingIndices[i] !== -1) {
        if (crdts[i].ch === ' ' || crdts[i].ch === '\n')
          editorTextModel.pushStackElement();

        this.writeCharToScreenAtIndex(
          editorTextModel,
          insertingChar[i],
          insertingIndices[i]
        );
        // auxiliary editor
        this.writeCharToScreenAtIndex(
          auxEditorTextModel,
          insertingChar[i],
          insertingIndices[i]
        );
      }
    }
    */
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

    // this.messageService.broadcastRangeRemove(removedCRDTStrings, roomName); // OLD MODEL - SIGNAL R

    this.crdtsToTransfer = removedCRDTs;
    this.crdtEvent.emit(false);
  }

  handleRemoteRangeRemove(
    editorTextModel: any,
    auxEditorTextModel: any,
    crdts: CRDT[]
  ): void {
    const deletingIndices = new Array<number>(crdts.length);
    let offSet = 0;
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

    // Delete continuous ranges of text from the screen
    let i = 0;
    let startIndexMonaco = -1;
    let endIndexMonaco = -1;
    while (i < actuallyDeletingIndices.length) {
      // Find continuous ranges of text
      startIndexMonaco = actuallyDeletingIndices[i];
      endIndexMonaco = startIndexMonaco;
      console.log(actuallyDeletingIndices);
      while (i < actuallyDeletingIndices.length) {
        if (
          endIndexMonaco !== startIndexMonaco &&
          actuallyDeletingIndices[i] !== actuallyDeletingIndices[i - 1] + 1
        ) {
          i++;
          break;
        }
        endIndexMonaco = actuallyDeletingIndices[i];
        i++;
      }

      if (actuallyDeletingIndices.length > 10) {
        editorTextModel.pushStackElement();
      }

      console.log('Delete from ' + startIndexMonaco + ' to ' + endIndexMonaco);
      // Delete from the screen
      EditorService.remoteOpLeft++; // Avoid triggering monaco change event
      this.deleteTextInRangeIndex(
        editorTextModel,
        startIndexMonaco,
        endIndexMonaco + 1
      );

      // aux Editor
      this.deleteTextInRangeIndex(
        auxEditorTextModel,
        startIndexMonaco,
        endIndexMonaco + 1
      );
    }

    /*// Right now: Naively delete each char from the screen
    for (let i = 0; i < crdts.length; i++) {
      if (deletingIndices[i] === -1) continue; // CRDT doesn't exist. Somebody's already deleted it!

      const startPos = this.indexToPos(editorTextModel, deletingIndices[i]);
      const endPos = this.indexToPos(editorTextModel, deletingIndices[i] + 1);
      this.deleteTextInRange(
        editorTextModel,
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      );
      this.deleteTextInRange(
        auxEditorTextModel,
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      );
    }*/
  }

  handleAllMessages(
    editorTextModel: any,
    auxEditorTextModel: any,
    crdts: CRDT[]
  ): void {
    // if isAllMessages=true => need to sort arr in handleRemoteRangeInsert. ACTUALLY, WE DON'T NEED TO SORT :)
    this.handleRemoteRangeInsert(
      editorTextModel,
      auxEditorTextModel,
      crdts,
      true
    );
  }

  getOldCRDTsAsSortedArray(): CRDT[] {
    return this.bst.toSortedArray();
  }

  writeRangeOfTextToScreenAtIndex(
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

  deleteTextInRangeIndex(
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

  deleteTextInRangePos(
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

  writeRangeOfTextToScreenAtPos(
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
        },
      ]
    );
  }

  private posToIndex(
    editorTextModel: any,
    endLineNumber: number,
    endColumn: number
  ): number {
    return editorTextModel.getOffsetAt(
      new monaco.Position(endLineNumber, endColumn)
    );
  }

  private indexToPos(editorTextModel: any, index: number): any {
    return editorTextModel.getPositionAt(index);
  }

  getCrdtsToTransfer() {
    return this.crdtsToTransfer;
  }
}
