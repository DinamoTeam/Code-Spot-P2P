import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { MessageService } from './message.service';
import { BalancedBST } from '../shared/BalancedBST';
import { CodeEditorComponent } from '../code-editor/code-editor.component';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static siteId: number = -1;
  curClock: number = 0;
  bst: BalancedBST<CRDT>;

  static setSiteId(id: number): void {
    EditorService.siteId = id;
  }

  constructor(private messageService: MessageService) {
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
    startColumn: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1)
      throw new Error('Error: call handleLocalInsert before setting siteId');

    if (newText === '') return;

    // IMPORTANT: Update auxiliary editor ONLY AFTER getting the CORRECT startIndex
    const startIndex =
      this.posToIndex(auxEditorTextModel, startLineNumber, startColumn) + 1; // Because we have __beg limit
    this.writeCharToScreenAtPos(
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

    this.curClock += chArr.length; // Generate N new CRDTId therefore increment curClock by N

    let chArrIndex = 0;
    const listCRDTBetween = listCrdtIdsBetween.map(
      (crdtId) => new CRDT(chArr[chArrIndex++], crdtId)
    );

    for (let i = 0; i < listCRDTBetween.length; i++) {
      this.bst.insert(listCRDTBetween[i]);
    }

    const listCRDTString = listCRDTBetween.map((crdt) => crdt.toString());
    this.messageService.broadcastRangeInsert(listCRDTString, roomName);
  }

  handleRemoteRangeInsert(
    editorTextModel: any,
    auxEditorTextModel: any,
    crdtStrs: string[],
    codeEditorComponent: CodeEditorComponent,
    isAllMessages = false
  ) {
    const crdts = crdtStrs.map((crdtStr) => CRDT.parse(crdtStr));
    if (isAllMessages) {
      crdts.sort((crdt1, crdt2) => crdt1.compareTo(crdt2)); // Sort by descending order
    }

    const insertingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const insertingIndex = this.bst.insert(crdts[i]);
      if (insertingIndex === -1) insertingIndices[i] = -1;
      else insertingIndices[i] = insertingIndex - 1; // Because of __beg limit
    }

    const numToBeInserted = insertingIndices.filter((index) => index !== -1)
      .length;
    codeEditorComponent.incrementRemoteOpLeft(numToBeInserted);

    // Right now: Naively insert each char for testing purposes
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

    // TODO: Do smart stuff to insert ranges of chars to the correct position on the screen
  }

  handleLocalRangeRemove(
    auxEditorTextModel: any,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
    length: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1)
      throw new Error('Error: call handleLocalRemove before setting siteId');

    if (length === 0) return;

    // IMPORTANT: Update auxiliary editor ONLY AFTER getting the CORRECT startIndex
    const startIndex =
      this.posToIndex(auxEditorTextModel, startLineNumber, startColumn) + 1; // Because we have __beg limit
    this.deleteTextInRange(
      auxEditorTextModel,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn
    );

    const removedCRDTString: string[] = [];
    for (let i = 0; i < length; i++) {
      const crdtToBeRemoved = this.bst.getDataAt(startIndex);
      removedCRDTString.push(crdtToBeRemoved.toString());
      this.bst.remove(crdtToBeRemoved);
    }

    this.messageService.broadcastRangeRemove(removedCRDTString, roomName);
  }

  handleRemoteRangeRemove(
    editorTextModel: any,
    auxEditorTextModel: any,
    crdtStrs: string[],
    codeEditorComponent: CodeEditorComponent
  ): void {
    const crdts = crdtStrs.map((crdtStr) => CRDT.parse(crdtStr));
    const deletingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const deletingIndex = this.bst.remove(crdts[i]);
      if (deletingIndex === -1) deletingIndices[i] = -1;
      else deletingIndices[i] = deletingIndex - 1; // Because of __beg limit
    }

    const numToBeInserted = deletingIndices.filter((index) => index !== -1)
      .length;
    codeEditorComponent.incrementRemoteOpLeft(numToBeInserted);

    // Right now: Naively delete each char from the screen
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
    }

    // TODO: Do smart stuff to delete ranges of chars at the correct positions on the screen
  }

  handleAllMessages(
    editorTextModel: any,
    auxEditorTextModel: any,
    crdts: string[],
    codeEditorComponent: CodeEditorComponent
  ): void {
    // if isAllMessages=true => need to sort arr in handleRemoteRangeInsert
    this.handleRemoteRangeInsert(
      editorTextModel,
      auxEditorTextModel,
      crdts,
      codeEditorComponent,
      true
    );
  }

  writeCharToScreenAtIndex(
    editorTextModel: any,
    text: string,
    index: number
  ): void {
    const pos = this.indexToPos(editorTextModel, index);
    this.writeCharToScreenAtPos(
      editorTextModel,
      text,
      pos.lineNumber,
      pos.column
    );
  }

  deleteTextInRange(
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

  writeCharToScreenAtPos(
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

    // FOR DEBUG: Print Value in Range
    // console.log("(" + this.editorTextModel.getValueInRange(new monaco.Range(1, 0, endLineNumber, endColumn)) + ")");
  }

  private indexToPos(editorTextModel: any, index: number): any {
    return editorTextModel.getPositionAt(index);
  }
}
