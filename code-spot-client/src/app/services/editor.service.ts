import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  arr: CRDT[];
  curClock: number = 0;

  constructor() {
    this.arr[0] = new CRDT(
      "_beg",
      new CRDTId(
        [new Identifier(1, 0)],
        this.curClock++
      ));
    
    this.arr[1] = new CRDT(
      "_end",
      new CRDTId(
        [new Identifier(CustomNumber.BASE, 0)],
        this.curClock++
      ));
  }

  handleLocalInsert(ch: string, index: number): void {
    const siteIdTemp = 1;

    index += 1; // because we have beg limit
    const crdtIdBefore = this.arr[index - 1].id;
    const crdtIdAfter = this.arr[index].id;

    const crdtIdBetween = CRDTId.generatePositionBetween(crdtIdBefore, crdtIdAfter, siteIdTemp, this.curClock++);

    const crdtBetween = new CRDT(ch, crdtIdBetween);

    this.insertCrdtToSortedCrdtArr(crdtBetween, this.arr);
    this.broadCastInsert(crdtBetween);
  }

  handleLocalRemove(ch: string, index: number): void {

  }

  insertCrdtToSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): void {

  }

  broadCastInsert(crdt: CRDT): void {
    
  }

  removeCrdtFromSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): void {

  }

  broadcastRemove(crdt: CRDT): void {

  }
}
