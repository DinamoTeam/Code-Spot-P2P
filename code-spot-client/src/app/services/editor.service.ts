import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { Utils } from '../shared/Utils';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static siteId: number = -1;
  arr: CRDT[];
  curClock: number = 0;

  static setSiteId(id: number): void {
    EditorService.siteId = id;
    console.log(
      'EditorService: receive siteId ' + EditorService.siteId + ' from server'
    );
  }

  constructor() {
    this.arr = new Array<CRDT>();
    this.arr[0] = new CRDT(
      '_beg',
      new CRDTId([new Identifier(1, 0)], this.curClock++)
    );

    this.arr[1] = new CRDT(
      '_end',
      new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], this.curClock++)
    );
  }

  handleLocalInsert(ch: string, index: number): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalInsert before setting siteId');
    }

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
    this.broadCastInsert(crdtBetween);
  }

  handleLocalRemove(ch: string, index: number): void {
    if (EditorService.siteId === -1) {
      throw new Error('Error: call handleLocalRemove before setting siteId');
    }

    index += 1; // because we have beg limit
    const crdtToBeRemoved = this.arr[index];
    this.arr.splice(index, 1);

    this.broadcastRemove(crdtToBeRemoved);
  }

  handleRemoteInsert(crdt: CRDT): void {
    // TODO: Insert crdt to array, get index and reflect to the screen
  }

  handleRemoteRemove(crdt: CRDT): void {
    // TODO: Remove crdt from array, get index and reflect on the screen
  }

  broadCastInsert(crdt: CRDT): void {
    // TODO: invoke ExecuteInsert() from MessageHub.cs
    return;
  }

  broadcastRemove(crdt: CRDT): void {
    // TODO: Invoke ExecuteRemove() from MessageHub.cs
    return;
  }

  insertCharAtIndex(editorTextModel: any, text: string, index: number) {
    const pos = editorTextModel.indexToPos(index);
    console.log(pos);
    this.executeInsert(
      editorTextModel,
      text,
      pos.lineNumber,
      pos.column,
      pos.lineNumber,
      pos.column
    );
  }

  // Delete text from the screen
  executeRemove() {
    // TODO
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
