import { Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { Utils } from '../shared/Utils';
import { MessageService } from './message.service';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static siteId: number = -1;
  arr: CRDT[];
  curClock: number = 0;

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
    while (end >= beg) {
      let crdtToBeRemoved = this.arr[end];
      this.messageService.broadcastRemove(crdtToBeRemoved.toString(), roomName);
      end--;
    }

    this.arr.splice(startIndex, rangeLen);
  }

  handleRemoteInsert(editorTextModel: any, crdtStr: string): void {
    let crdt = CRDT.parse(crdtStr);
    const index = Utils.insertCrdtToSortedCrdtArr(crdt, this.arr);
    this.writeCharToScreenAtIndex(editorTextModel, crdt.ch, index - 1);
  }

  handleRemoteRemove(editorTextModel: any, crdtStr: string): void {
    let crdt = CRDT.parse(crdtStr);
    const index = Utils.removeCrdtFromSortedCrdtArr(crdt, this.arr);
    this.deleteCharFromScreenAtIndex(editorTextModel, crdt.ch, index - 1);
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

  deleteCharFromScreenAtIndex(
    editorTextModel: any,
    ch: string,
    index: number
  ): void {
    const pos = this.indexToPos(editorTextModel, index);
    this.executeRemove(editorTextModel, ch, pos.lineNumber, pos.column);
  }

  // Delete text from the screen
  executeRemove(
    editorTextModel: any,
    ch: string,
    startLineNumber: number,
    startColumn: number
  ) {
    let range = new monaco.Range(1, 1, 1, 1);
    if (ch === '\n') {
      range = new monaco.Range(
        startLineNumber,
        startColumn,
        startLineNumber + 1,
        1
      );
    } else {
      range = new monaco.Range(
        startLineNumber,
        startColumn,
        startLineNumber,
        startColumn + 1
      );
    }

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
