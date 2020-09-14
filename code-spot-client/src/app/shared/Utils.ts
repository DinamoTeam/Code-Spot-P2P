import { CRDT } from './CRDT';
import { Message } from './Message';
import { EventEmitter } from '@angular/core';
import { AnnounceType } from './AnnounceType';
import { NameColor } from './NameColor';
import * as alertify from 'alertifyjs';
import { AlertType } from './AlertType';
import { Languages } from './Languages';

export class CrdtUtils {

  static crdtArrToString(crdts: CRDT[], seperator: string): string {
    const crdtStrings = crdts.map((crdt) => crdt.toString());
    return crdtStrings.join(seperator);
  }

  static stringToCRDTArr(str: string, delimiter: string): CRDT[] {
    const crdtStrings = str.split(delimiter);
    const crdts = crdtStrings.map((crdtStr) => CRDT.parse(crdtStr));
    return crdts;
  }


  static MAX_STRING_LENGTH_PER_SEND = 64000; // 64Kb => 65536 bytes => 65536 chars. Leave some chars for JSON
  /**
   * Break huge crdts array into smaller arrays to avoid connection crash when sending
   */
  static breakCrdtsIntoCrdtStringBatches(
    crdts: CRDT[],
    delimiter: string
  ): string[] {
    const crdtStrings = crdts.map((crdt) => crdt.toString());
    const crdtStringsBatches: string[] = [];
    let startIndex = 0;
    let i: number;
    let curLength = 0;
    for (i = 0; i < crdtStrings.length; i++) {
      if (
        curLength + crdtStrings[i].length >=
        this.MAX_STRING_LENGTH_PER_SEND
      ) {
        crdtStringsBatches.push(
          crdtStrings.slice(startIndex, i).join(delimiter)
        );
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
  static announce = new EventEmitter<AnnounceType>();

  static connectionHasOpened(con: any, connections: any[]): boolean {
    return connections.findIndex((x) => x.peer === con.peer) !== -1;
  }

  static announceInfo(announceType: AnnounceType): void {
    PeerUtils.announce.emit(announceType);
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
    else PeerUtils.announceInfo(AnnounceType.UnhandledError);

    // TODO: WARN USER THAT THIS HAS STOP SYNC
  }
}

export class Utils {
  static broadcast = new EventEmitter<AnnounceType>();

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

  static addUniqueNameColor(
    nameColor: NameColor,
    listToBeAddedTo: NameColor[]
  ) {
    if (
      !listToBeAddedTo.find(
        (x) => x.name === nameColor.name && x.color === nameColor.color
      )
    ) {
      listToBeAddedTo.push(nameColor);
    }
  }

  static broadcastInfo(announceType: AnnounceType): void {
    Utils.broadcast.emit(announceType);
  }

  static alert(message: string, alertType: AlertType) {
    if (alertType === AlertType.Success) alertify.success(message);
    else if (alertType === AlertType.Warning) alertify.warning(message);
    else if (alertType === AlertType.Error) alertify.error(message);
    else if (alertType === AlertType.Message) alertify.message(message);
  }

  static inArray(item: any, array: any[]) {
    return array.findIndex(elem => elem === item) !== -1;
  }

  confirm(message: string, okCallback: () => any) {
    alertify.confirm(message, (e: any) => {
      if (e) okCallback();
    });
  }

  static getLanguageName(lang: string) {
    return Languages.find(elem => elem.value === lang).name;
  }

  static getLanguageExt(lang: string) {
    return Languages.find(elem => elem.value === lang).ext;
  }
}
