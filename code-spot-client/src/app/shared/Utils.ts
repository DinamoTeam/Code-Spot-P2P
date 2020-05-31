import { CRDT } from './CRDT';

export class Utils {
  // Prototype: linear search. Future: binary search
  static insertCrdtToSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): number {
    for (let i = 1; i < crdtArr.length - 1; i++) {
      // ignore borders at 0 and length-1
      if (crdt.compareTo(crdtArr[i]) === 0) {
        throw new Error('Cannot insert duplicate element into CRDT Array!');
      } else if (crdt.compareTo(crdtArr[i]) > 0) {
        crdtArr.splice(i, 0, crdt);
        return i;
      }
    }
    throw new Error('Failed to insert crdt object inside the borders');
  }

  // Prototype: linear search. Future: binary search
  static removeCrdtFromSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): number {
    for (let i = 1; i < crdtArr.length - 1; i++) {
      // ignore borders at 0 and length-1
      if (crdt.compareTo(crdtArr[i]) === 0) {
        crdtArr.splice(i, 1);
        return i;
      }
    }
    throw new Error(
      'Fail to delete crdt object! The object does not exist inside the array'
    );
  }
}
