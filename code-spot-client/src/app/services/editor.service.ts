import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  arr: CRDT[];
  static curClock: number = 0;

  constructor() {
    this.arr[0] = new CRDT(
      "_beg",
      new CRDTId(
        [new Identifier(1, 0)],
        0
      ));
    this.arr[1] = new CRDT(
      "_end",
      new CRDTId(
        [new Identifier(CustomNumber.BASE, 0)],
        1
      ));
  }

  handleLocalInsert(ch: string, index: number): void {
    index += 1; // because we have beg limit
    const crdtIdBefore = this.arr[index - 1].id;
    const crdtIdAfter = this.arr[index].id;

    const crdtIdBetween = CRDTId.generatePositionBetween(crdtIdBefore, crdtIdAfter, )
  }
}
