import { Injectable } from "@angular/core";
import { CRDT, CRDTId, Identifier } from "../shared/CRDT";
import { CustomNumber } from "../shared/CustomNumber";

@Injectable({
  providedIn: "root",
})
export class EditorService {
  arr: CRDT[];
  curClock: number = 0;

  constructor() {
    this.arr = new Array<CRDT>();
    this.arr[0] = new CRDT(
      "_beg",
      new CRDTId([new Identifier(1, 0)], this.curClock++)
    );

    this.arr[1] = new CRDT(
      "_end",
      new CRDTId([new Identifier(CustomNumber.BASE, 0)], this.curClock++)
    );
  }

  handleLocalInsert(ch: string, index: number): void {
    const siteIdTemp = 1;

    index += 1; // because we have beg limit
    const crdtIdBefore = this.arr[index - 1].id;
    const crdtIdAfter = this.arr[index].id;

    const crdtIdBetween = CRDTId.generatePositionBetween(
      crdtIdBefore,
      crdtIdAfter,
      siteIdTemp,
      this.curClock++
    );

    const crdtBetween = new CRDT(ch, crdtIdBetween);

    this.insertCrdtToSortedCrdtArr(crdtBetween, this.arr);
    this.broadCastInsert(crdtBetween);
  }

  handleLocalRemove(ch: string, index: number): void {
    const siteIdTemp = 1;

    index += 1; // because we have beg limit
    const crdtToBeRemoved = this.arr[index];
    this.arr.splice(index, 1);

    this.broadcastRemove(crdtToBeRemoved);
  }

  // Prototype: linear search. Future: binary search
  insertCrdtToSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): number {
    for (let i = 1; i < crdtArr.length - 1; i++) {
      // ignore borders at 0 and length-1
      if (crdt.compareTo(crdtArr[i]) === 0) {
        throw new Error("Cannot insert duplicate element into CRDT Array!");
      } else if (crdt.compareTo(crdtArr[i]) > 0) {
        crdtArr.splice(i, 0, crdt);
        return i;
      }
    }
    throw new Error("Failed to insert crdt object inside the borders");
  }

  broadCastInsert(crdt: CRDT): void {
    // TODO
    return;
  }

  // Prototype: linear search. Future: binary search
  removeCrdtFromSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): number {
    for (let i = 1; i < crdtArr.length - 1; i++) {
      // ignore borders at 0 and length-1
      if (crdt.compareTo(crdtArr[i]) === 0) {
        crdtArr.splice(i, 1);
        return i;
      }
    }
    throw new Error(
      "Fail to delete crdt object! The object does not exist inside the array"
    );
  }

  broadcastRemove(crdt: CRDT): void {
    // TODO
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
    //console.log("(" + this.editorTextModel.getValueInRange(new monaco.Range(1, 0, endLineNumber, endColumn)) + ")");
  }

  indexToPos(editorTextModel: any, index: number): any {
    return editorTextModel.getPositionAt(index);
  }
}
