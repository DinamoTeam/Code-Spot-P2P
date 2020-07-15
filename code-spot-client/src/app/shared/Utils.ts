import { CRDT } from './CRDT';
import { Message } from './Message';
import { EventEmitter } from '@angular/core';
import { BroadcastInfo } from './BroadcastInfo';

export class Utils {
  // Prototype: linear search. Future: binary search
  static insertCrdtToSortedCrdtArr(crdt: CRDT, crdtArr: CRDT[]): number {
    for (let i = 1; i < crdtArr.length; i++) {
      // ignore borders at 0 and length-1
      if (crdt.compareTo(crdtArr[i]) === 0) {
        throw new Error('Cannot insert duplicate element into CRDT Array!');
      } else if (crdt.compareTo(crdtArr[i]) < 0) {
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

  static crdtArrToString(crdts: CRDT[], seperator: string): string {
    const crdtStrings = crdts.map((crdt) => crdt.toString());
    // console.log('crdtArr: ');
    // console.log(crdts);
    // console.log('crdtStrings: ');
    // console.log(crdtStrings);
    // console.log('Join: ');
    // console.log(crdtStrings.join(seperator));
    return crdtStrings.join(seperator);
  }

  static stringToCRDTArr(str: string, delimiter: string): CRDT[] {
    const crdtStrings = str.split(delimiter);
    const crdts = crdtStrings.map((crdtStr) => CRDT.parse(crdtStr));
    // console.log('crdtStrings: ');
    // console.log(str);
    // console.log('crdtString splitted: ');
    // console.log(crdtStrings);
    // console.log('crdt parsed: ');
    // console.log(crdts);
    return crdts;
  }

  static addUniqueConnections(list: any[], listToBeAddedTo: any[]) {
    list.forEach((obj) => {
      let hasExist = false;
      for (let i = 0; i < listToBeAddedTo.length; i++) {
        if (obj.peer === listToBeAddedTo[i].peer) {
          hasExist = true;
          break;
        }
      }
      if (!hasExist) {
        listToBeAddedTo.push(obj);
      }
    });
  }

  static addUniqueMessages(list: Message[], listToBeAddedTo: Message[]) {
    list.forEach((message) => {
      let weHadThatMessage = false;
      for (let i = 0; i < listToBeAddedTo.length; i++) {
        if (
          listToBeAddedTo[i].fromPeerId === message.fromPeerId &&
          listToBeAddedTo[i].time === message.time
        ) {
          weHadThatMessage = true;
          break;
        }
      }
      if (!weHadThatMessage) {
        listToBeAddedTo.push(message);
      }
    });
  }

  static refreshAndGoBackHomePage() {
    window.location.replace('/');
  }
}

export class PeerUtils {
  static broadcast = new EventEmitter<BroadcastInfo>();

  static connectionHasOpened(con: any, connections: any[]): boolean {
    return connections.findIndex(x => x.peer === con.peer) !== -1;
  }

  static broadcastInfo(infoType: BroadcastInfo): void {
    PeerUtils.broadcast.emit(infoType);
  }
}
