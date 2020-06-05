import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { Utils } from '../shared/Utils';
import { MessageService } from './message.service';
import { BalancedBST } from '../shared/BalancedBST';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static siteId: number = -1;
  arr: CRDT[];
  curClock: number = 0;
  bst: BalancedBST<CRDT>; // new

  static setSiteId(id: number): void {
    EditorService.siteId = id;
  }

  constructor(private messageService: MessageService) {
    this.arr = new Array<CRDT>();
    this.arr.push(
      new CRDT('_beg', new CRDTId([new Identifier(1, 0)], this.curClock++))
    );

    this.arr.push(
      new CRDT(
        '_end',
        new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], this.curClock++)
      )
    );

    // new
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

  // new
  handleLocalRangeInsert(
    editorTextModel: any,
    chArr: string[],
    startIndex: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalInsert before setting siteId');
    }
    startIndex += 1; // Because we have beg limit

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
    for (let i = 0; i < listCRDTBetween.length; i++) {
      this.bst.insert(listCRDTBetween[i]);
    }
    const listCRDTString = listCRDTBetween.map((crdt) => crdt.toString());
    this.messageService.broadcastRangeInsert(listCRDTString, roomName);
  }

  // new
  handleRemoteRangeInsert(editorTextModel: any, crdtStrs: string[]) {
    const crdts = crdtStrs.map((crdtStr) => CRDT.parse(crdtStr));
    const insertingChar = crdts.map((crdt) => crdt.ch);
    const insertingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const insertingIndex = this.bst.insert(crdts[i]);
      insertingIndices[i] = insertingIndex;
    }

    // Right now: Naively insert each char for testing purposes
    for (let i = 0; i < crdts.length; i++) {
      this.writeCharToScreenAtIndex(editorTextModel, insertingChar[i], insertingIndices[i]);
    }
    // TODO: Do smart stuff to insert each char to the correct position on the screen
  }

  // new
  handleLocalRangeRemoveNEW(
    editorTextModel: any,
    startIndex: number,
    length: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalRemove before setting siteId');
    }

    const removedCRDTString: string[] = [];
    for (let i = 0; i < length; i++) {
      const crdtToBeRemoved = this.bst.getDataAt(startIndex);
      removedCRDTString.push(crdtToBeRemoved.toString());
      this.bst.remove(crdtToBeRemoved);
    }

    this.messageService.broadcastRangeRemoveNEW(removedCRDTString, roomName);
  }

  handleRemoteRangeRemoveNEW(editorTextModel: any, crdtStrs: string[]): void {
    const crdts = crdtStrs.map((crdtStr) => CRDT.parse(crdtStr));
    const deletingIndices = new Array<number>(crdts.length);

    for (let i = 0; i < crdts.length; i++) {
      const deleteingIndex = this.bst.remove(crdts[i]);
      deletingIndices[i] = deleteingIndex;
    }

    // TODO: Do smart stuff to delete at the correct positions on the screen
  }

  handleLocalInsert(
    editorTextModel: any,
    ch: string,
    endLineNumber: number,
    endColumn: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalInsert before setting siteId');
    }

    let index = this.posToIndex(editorTextModel, endLineNumber, endColumn);
    index += 1; // because we have beg limit
    const crdtIdBefore = this.arr[index - 1].id;
    const crdtIdAfter = this.arr[index].id;

    const crdtIdBetween = CRDTId.generatePositionBetween(
      crdtIdBefore,
      crdtIdAfter,
      EditorService.siteId,
      this.curClock++
    );

    const crdtBetween = new CRDT(ch, crdtIdBetween);

    Utils.insertCrdtToSortedCrdtArr(crdtBetween, this.arr);
    this.messageService.broadcastInsert(crdtBetween.toString(), roomName);
  }

  handleLocalRangeRemove(
    editorTextModel: any,
    startLineNumber: number,
    startColumn: number,
    rangeLen: number,
    roomName: string
  ): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalRemove before setting siteId');
    }

    let startIndex =
      this.posToIndex(editorTextModel, startLineNumber, startColumn) + 1; // because we have beg limit

    const beg = startIndex;
    let end = startIndex + rangeLen - 1;
    let crdtsStr = new Array<string>();
    while (end >= beg) {
      crdtsStr.push(this.arr[end].toString());
      end--;
    }

    this.arr.splice(startIndex, rangeLen);
    this.messageService.broadcastRangeRemove(
      crdtsStr,
      String(startIndex),
      String(rangeLen),
      roomName
    );
  }

  handleRemoteInsert(editorTextModel: any, crdtStr: string): void {
    let crdt = CRDT.parse(crdtStr);
    const index = Utils.insertCrdtToSortedCrdtArr(crdt, this.arr);
    this.writeCharToScreenAtIndex(editorTextModel, crdt.ch, index - 1);
  }

  handleRemoteRangeRemove(
    editorTextModel: any,
    startIndex: number,
    rangeLen: number
  ): void {
    const startPos = this.indexToPos(editorTextModel, startIndex - 1);
    const endPos = this.indexToPos(editorTextModel, startIndex + rangeLen - 1);

    this.deleteTextInRange(
      editorTextModel,
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    );
    this.arr.splice(startIndex, rangeLen);
  }

  handleAllMessages(editorTextModel: any, crdts: string[]): void {
    for (var i = 0; i < crdts.length; i++) {
      this.handleRemoteInsert(editorTextModel, crdts[i]);
    }
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
