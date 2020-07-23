import { CRDT } from './CRDT';
import { Message } from './Message';
import { EventEmitter } from '@angular/core';
import { BroadcastInfo } from './BroadcastInfo';
import { NameColor } from './NameColor';

export class CrdtUtils {
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
    return crdtStrings.join(seperator);
  }

  static stringToCRDTArr(str: string, delimiter: string): CRDT[] {
    const crdtStrings = str.split(delimiter);
    const crdts = crdtStrings.map((crdtStr) => CRDT.parse(crdtStr));
    return crdts;
  }

  // Break huge crdts array into smaller arrays and send each one to avoid connection crash
  static MAX_STRING_LENGTH_PER_SEND = 64000; // 64Kb => 65536 bytes => 65536 chars. Leave some chars for JSON
  static breakCrdtsIntoCrdtStringBatches(crdts: CRDT[], delimiter: string): string[] {
    const crdtStrings = crdts.map(crdt => crdt.toString());
    const crdtStringsBatches: string[] = [];
    let startIndex = 0;
    let i: number;
    let curLength = 0;
    for (i = 0; i < crdtStrings.length; i++) {
      if (curLength + crdtStrings[i].length >= this.MAX_STRING_LENGTH_PER_SEND) {
        crdtStringsBatches.push(crdtStrings.slice(startIndex, i).join(delimiter));
        startIndex = i;
        curLength = 0;
        i--;
      } else {
        curLength += crdtStrings[i].length + 2; // +2 for delimiter
      }
    }
    crdtStringsBatches.push(crdtStrings.slice(startIndex, i).join(delimiter));
    return crdtStringsBatches;
  }
}

export class PeerUtils {
  static broadcast = new EventEmitter<BroadcastInfo>();

  static connectionHasOpened(con: any, connections: any[]): boolean {
    return connections.findIndex((x) => x.peer === con.peer) !== -1;
  }

  static broadcastInfo(infoType: BroadcastInfo): void {
    PeerUtils.broadcast.emit(infoType);
  }

  static addUniqueMessages(list: Message[], listToBeAddedTo: Message[]) {
    list.forEach((message) => {
      let weHadThatMessage = false;
      for (let i = 0; i < listToBeAddedTo.length; i++) {
        if (
          listToBeAddedTo[i].fromPeerId === message.fromPeerId &&
          listToBeAddedTo[i].chatMessageTime === message.chatMessageTime
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

  static handlePeerError(message: string) {
    let ans = confirm(message);
    if (ans === true) window.location.replace('/');
    else console.log("WARN USER THAT THIS HAS STOP SYNC");

    // TODO: WARN USER THAT THIS HAS STOP SYNC
  }
}

export class Utils {
  static broadcast = new EventEmitter<BroadcastInfo>();

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

  static addUniqueNameColor(nameColor: NameColor, listToBeAddedTo: NameColor[]) {
    if (!listToBeAddedTo.find(x => x.name === nameColor.name && x.color === nameColor.color)) {
      listToBeAddedTo.push(nameColor);
    }
  }

  static broadcastInfo(infoType: BroadcastInfo): void {
    Utils.broadcast.emit(infoType);
  }
}
