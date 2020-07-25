import { CRDT } from './CRDT';

/**
 * Attempt to replace Monaco undo stack. Unfinished.
 */
export class EditStack {
  private arr: Array<Edit>;
  constructor() {
    this.arr = new Array<Edit>();
  }
  push(edit: Edit): void {
    this.arr.push(edit);
  }
  pop(): Edit {
    if (this.arr.length === 0) {
      return null;
    }
    return this.arr.pop();
  }
  popTillStop(): Edit[] {
    if (this.arr.length === 0) {
      return null;
    }
    const editArr: Edit[] = [];
    while (this.arr.length > 0 && !this.arr[this.arr.length - 1].isStop) {
      editArr.push(this.arr.pop());
    }
    return editArr;
  }
  markStop(): void {
    if (this.arr.length > 0) {
      this.arr[this.arr.length - 1].isStop = true;
    }
  }
  clear(): void {
      this.arr = new Array<Edit>();
  }
  isEmpty(): boolean {
    return this.arr.length === 0;
  }
}

export const enum EditType {
  Remove = 0,
  Insert = 1,
}

export class Edit {
  constructor(edit: Array<CRDT>, editType: EditType, isStop: boolean) {
    this.edit = edit;
    this.editType = editType;
    this.isStop = isStop;
  }
  edit: Array<CRDT>;
  editType: EditType;
  isStop: boolean;
}
