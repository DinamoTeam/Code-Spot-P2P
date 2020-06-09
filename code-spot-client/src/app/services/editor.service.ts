import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { MessageService } from './message.service';
import { BalancedBST } from '../shared/BalancedBST';

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
    editorTextModel: any,
    newText: string,
    startLineNumber: number,
    startColumn: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalInsert before setting siteId');
    }
    const startIndex =
      this.posToIndex(editorTextModel, startLineNumber, startColumn) + 1; // Because we have beg limit

    const chArr = newText.split('');
    const N = chArr.length;
    let chArrIndex = 0;
    const crdtIdBefore = this.bst.getDataAt(startIndex - 1).id;
    const crdtIdAfter = this.bst.getDataAt(startIndex).id;
    const listCrdtIdsBetween = CRDTId.generateNPositionsBetween(
      crdtIdBefore,
      crdtIdAfter,
      N,
      EditorService.siteId,
      this.curClock
    );
    this.curClock += N; // Generate N new CRDTId therefore increment curClock by N
    const listCRDTBetween = listCrdtIdsBetween.map(
      (crdtId) => new CRDT(chArr[chArrIndex++], crdtId)
    );
    //console.log('To be inserted: ' + listCRDTBetween);
    for (let i = 0; i < listCRDTBetween.length; i++) {
      this.bst.insert(listCRDTBetween[i]);
    }
    const listCRDTString = listCRDTBetween.map((crdt) => crdt.toString());
    this.messageService.broadcastRangeInsert(listCRDTString, roomName);

    //console.log('DONE handleLocalRangeInsert');
  }

  handleRemoteRangeInsert(
    editorTextModel: any,
    crdtStrs: string[],
    isAllMessages = false
  ) {
    const crdts = crdtStrs.map((crdtStr) => CRDT.parse(crdtStr));
    if (isAllMessages) {
      crdts.sort((crdt1, crdt2) => crdt1.compareTo(crdt2)); // Sort by descending order
    }
    const insertingChar = crdts.map((crdt) => crdt.ch);
    const insertingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const insertingIndex = this.bst.insert(crdts[i]);
      insertingIndices[i] = insertingIndex - 1; // Because of beg limit
    }

    //console.log('Start writing to text');
    // Right now: Naively insert each char for testing purposes
    for (let i = 0; i < crdts.length; i++) {
      this.writeCharToScreenAtIndex(
        editorTextModel,
        insertingChar[i],
        insertingIndices[i]
      );
    }
    //console.log('Done writing to text');
    // TODO: Do smart stuff to insert each char to the correct position on the screen
  }

  handleLocalRangeRemove(
    editorTextModel: any,
    startLineNumber: number,
    startColumn: number,
    length: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalRemove before setting siteId');
    }

    const startIndex =
      this.posToIndex(editorTextModel, startLineNumber, startColumn) + 1; // Because we have beg limit

    const removedCRDTString: string[] = [];
    for (let i = 0; i < length; i++) {
      const crdtToBeRemoved = this.bst.getDataAt(startIndex);
      removedCRDTString.push(crdtToBeRemoved.toString());
      this.bst.remove(crdtToBeRemoved);
    }

    this.messageService.broadcastRangeRemove(removedCRDTString, roomName);
  }

  handleRemoteRangeRemove(editorTextModel: any, crdtStrs: string[]): void {
    const crdts = crdtStrs.map((crdtStr) => CRDT.parse(crdtStr));
    const deletingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const deleteingIndex = this.bst.remove(crdts[i]);
      deletingIndices[i] = deleteingIndex;
    }

    // Right now: Naively delete each char from the screen
    for (let i = 0; i < crdts.length; i++) {
      if (deletingIndices[i] === -1) {
        // CRDT doesn't exist. Somebody's already deleted it!
        continue;
      }
      const startPos = this.indexToPos(editorTextModel, deletingIndices[i] - 1);
      const endPos = this.indexToPos(editorTextModel, deletingIndices[i]);
      this.deleteTextInRange(
        editorTextModel,
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      );
    }

    // TODO: Do smart stuff to delete at the correct positions on the screen
  }

  handleAllMessages(editorTextModel: any, crdts: string[]): void {
    // if isAllMessages=true => need to sort arr in handleRemoteRangeInsert
    this.handleRemoteRangeInsert(editorTextModel, crdts, true);
  }

  writeCharToScreenAtIndex(
    editorTextModel: any,
    text: string,
    index: number
  ): void {
    const pos = this.indexToPos(editorTextModel, index);
    this.executeInsert(
      editorTextModel,
      text,
      pos.lineNumber,
      pos.column,
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

  // Write text to the screen
  executeInsert(
    editorTextModel: any,
    text: string,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ) {
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
          text: text,
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

    // FOR DEBUG: Print Value in Range
    // console.log("(" + this.editorTextModel.getValueInRange(new monaco.Range(1, 0, endLineNumber, endColumn)) + ")");
  }

  indexToPos(editorTextModel: any, index: number): any {
    return editorTextModel.getPositionAt(index);
  }
}
