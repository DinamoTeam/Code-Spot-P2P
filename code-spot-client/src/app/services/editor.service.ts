import { EventEmitter, Injectable } from '@angular/core';
import { CRDT, CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';
import { BalancedBST } from '../shared/BalancedBST';
import { CursorService } from './cursor.service';
import { CursorChangeReason } from '../shared/CursorChangeReason';
import { CursorChangeSource } from '../shared/CursorChangeSource';
import { SelectionChangeInfo } from '../shared/SelectionChangeInfo';
import { CursorChangeInfo } from '../shared/CursorChangeInfo';
import { Edit, EditStack, EditType } from '../shared/EditStack';

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  static defaultLanguage: string = 'cpp';
  static currentLanguage: string = EditorService.defaultLanguage;
  static siteId: number = -1;
  static remoteOpLeft: number = 0;
  curClock: number = 0;
  bst: BalancedBST<CRDT>;
  crdtEvent = new EventEmitter<boolean>();
  crdtsToTransfer: CRDT[];
  undoStack: EditStack;
  redoStack: EditStack;

  static setSiteId(id: number): void {
    EditorService.siteId = id;
  }

  constructor(private cursorService: CursorService) {
    // Init BST and add 'begin' and 'end' CRDTs.
    // All CRDTs from now on will be in between these 2 limits
    this.bst = new BalancedBST<CRDT>();
    this.bst.insert(
      new CRDT('_beg', new CRDTId([new Identifier(1, 0)], this.curClock++))
    );
    this.bst.insert(
      new CRDT(
        '_end',
        new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], this.curClock++)
      )
    );
    this.undoStack = new EditStack();
    this.redoStack = new EditStack();
  }

  /**
   * Is called when our user inserts some text. This function will generate CRDT objects
   * correspond to each new char, add them to BST and then broadcast these new CRDT objects
   */
  handleLocalInsert(
    auxEditor: any,
    textToInsert: string,
    startLineNumber: number,
    startColumn: number,
    markUndoStop: boolean
  ): void {
    if (EditorService.siteId === -1)
      throw new Error('Error: call handleLocalInsert before setting siteId');

    if (textToInsert === '') return;

    const auxEditorTextModel = auxEditor.getModel();

    // IMPORTANT: Update auxiliary editor ONLY AFTER getting the CORRECT insertAtIndex
    const insertAtIndex =
      this.posToIndex(auxEditorTextModel, startLineNumber, startColumn) + 1; // Because we have _beg limit
    // Update aux editor
    this.writeTextToMonacoAtPos(
      auxEditor,
      auxEditorTextModel,
      textToInsert,
      startLineNumber,
      startColumn
    );

    const chArr = textToInsert.split('');

    // Generate N CrdtIds correspond to N chars in textToInsert
    const crdtIdBefore = this.bst.getDataAt(insertAtIndex - 1).id;
    const crdtIdAfter = this.bst.getDataAt(insertAtIndex).id;
    const listCrdtIdsBetween = CRDTId.generateNPositionsBetween(
      crdtIdBefore,
      crdtIdAfter,
      chArr.length,
      EditorService.siteId,
      this.curClock
    );

    this.curClock += chArr.length; // Generate N new CRDTIds therefore increment curClock by N

    // Combine CrdtId and char to make CRDT object
    let chArrIndex = 0;
    const listCRDTBetween = listCrdtIdsBetween.map(
      (crdtId) => new CRDT(chArr[chArrIndex++], crdtId)
    );

    // Insert to our BST
    for (let i = 0; i < listCRDTBetween.length; i++) {
      this.bst.insert(listCRDTBetween[i]);
    }

    const newUndo = new Edit(listCRDTBetween, EditType.Insert, markUndoStop);
    this.undoStack.push(newUndo);

    this.tellPeerServerToBroadcast(listCRDTBetween, true);
  }

  /**
   * Is called when a peer sends us a remote insert request. This function will take
   * these new CRDT objects, insert them to BST to compute their indices and then write them
   * to their correct positions on Monaco Editor
   */
  handleRemoteInsert(
    editor: any,
    auxEditor: any,
    newCRDTs: CRDT[],
    fromPeerId: string
  ) {
    const editorTextModel = editor.getModel();
    const auxEditorTextModel = auxEditor.getModel();

    const insertingIndices = new Array<number>(newCRDTs.length);

    // Note: Indices from BST and from Monaco Editor are in sync. Getting the correct indices
    // from BST means that we have computed the correct indices to write to Monaco
    for (let i = 0; i < newCRDTs.length; i++) {
      const insertingIndex = this.bst.insert(newCRDTs[i]);
      if (insertingIndex === -1) insertingIndices[i] = -1;
      else insertingIndices[i] = insertingIndex - 1; // '-1' because __beg limit in BST increase index by 1
    }

    // Rule out -1 indices (-1 indices mean we have inserted these CRDTs before)
    const actuallyInsertingChars: string[] = [];
    for (let i = 0; i < newCRDTs.length; i++) {
      if (insertingIndices[i] !== -1) {
        actuallyInsertingChars.push(newCRDTs[i].ch);
      }
    }
    const actuallyInsertingIndices = insertingIndices.filter(
      (index) => index !== -1
    );

    // Write continuous ranges of text to screen
    let i = 0;
    let startIndexMonaco = -1;
    let endIndexMonaco = -1;
    while (i < actuallyInsertingIndices.length) {
      // Find continuous ranges of text
      startIndexMonaco = actuallyInsertingIndices[i];
      let j = i + 1;
      while (
        j < actuallyInsertingIndices.length &&
        actuallyInsertingIndices[j] === actuallyInsertingIndices[j - 1] + 1
      ) {
        j++;
      }
      endIndexMonaco = actuallyInsertingIndices[j - 1];
      i = j;

      // Get text to be inserted
      const numElements = endIndexMonaco - startIndexMonaco + 1;
      const endIndexArrInclusive = i - 1;
      const startIndexArr = endIndexArrInclusive - numElements + 1;
      const textToInsert = actuallyInsertingChars
        .slice(startIndexArr, endIndexArrInclusive + 1)
        .join('');

      if (
        actuallyInsertingChars[startIndexArr] === ' ' ||
        actuallyInsertingChars[startIndexArr] === '\n' ||
        actuallyInsertingChars.length > 10
      ) {
        editorTextModel.pushStackElement();
      }

      EditorService.remoteOpLeft++; // Avoid triggering monaco change event

      // Write text to aux Editor
      this.writeTextToMonacoAtIndex(
        auxEditor,
        auxEditorTextModel,
        textToInsert,
        startIndexMonaco
      );

      // Write text to main Monaco Editor
      this.writeTextToMonacoAtIndex(
        editor,
        editorTextModel,
        textToInsert,
        startIndexMonaco
      );

      // Calculate new pos for nameTag after remote insert
      this.cursorService.recalculateAllNameTagAndCursorIndicesAfterInsert(
        startIndexMonaco,
        textToInsert.length,
        fromPeerId
      );
    }

    // Redraw nameTags
    this.cursorService.redrawPeersNameTagsAndCursors(editor);
  }

  /**
   * Is called when our user removes some text. This function will remove corresponding
   * CRDT objects from BST and broadcast these removed CRDTs to the rest in room
   */
  handleLocalRemove(
    auxEditor: any,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
    length: number,
    markUndoStop: boolean
  ): void {
    if (EditorService.siteId === -1)
      throw new Error('Error: call handleLocalRemove before setting siteId');

    if (length === 0) return;

    const auxEditorTextModel = auxEditor.getModel();

    // IMPORTANT: Update auxiliary editor ONLY AFTER getting the CORRECT startIndex
    const startIndex =
      this.posToIndex(auxEditorTextModel, startLineNumber, startColumn) + 1; // // '+1' because __beg limit in BST increase index by 1
    this.deleteTextFromMonacoByPos(
      auxEditorTextModel,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn
    );

    // Note: Indices from BST and from Monaco Editor are in sync.
    // Ex: CRDT at index 5 from BST will correspond to char at index 5 from Monaco
    const removedCRDTs: CRDT[] = [];
    for (let i = 0; i < length; i++) {
      const crdtToBeRemoved = this.bst.getDataAt(startIndex);
      removedCRDTs.push(crdtToBeRemoved);
      this.bst.remove(crdtToBeRemoved);
    }

    const newUndo = new Edit(removedCRDTs, EditType.Remove, markUndoStop);
    this.undoStack.push(newUndo);

    this.tellPeerServerToBroadcast(removedCRDTs, false);
  }

  /**
   * Is called when a peer sends us a remote remove request. This function will take
   * these to-be-removed CRDT objects, remove them from BST and get their indices,
   * then delete chars with the same indices in Monaco
   */
  handleRemoteRemove(
    editor: any,
    auxEditor: any,
    toBeRemovedCRDTs: CRDT[]
  ): void {
    const editorTextModel = editor.getModel();
    const auxEditorTextModel = auxEditor.getModel();

    const deletingIndices = new Array<number>(toBeRemovedCRDTs.length);
    let offSet = 0; // offSet to add back to index because deleting 1 element will decrease the indices of all elements after it
    for (let i = 0; i < toBeRemovedCRDTs.length; i++) {
      const deletingIndex = this.bst.remove(toBeRemovedCRDTs[i]);
      if (deletingIndex === -1) deletingIndices[i] = -1;
      else {
        deletingIndices[i] = deletingIndex - 1 + offSet; // '-1' because __beg limit in BST increase index by 1
        offSet++;
      }
    }

    // Rule out -1 indices (-1 means our BST doesn't have that CRDT. Probably either us or other peer has deleted it
    // before this request comes)
    const actuallyDeletingIndices = deletingIndices.filter(
      (index) => index !== -1
    );

    // Delete continuous ranges of text from the screen
    let i = actuallyDeletingIndices.length - 1; // Delete backwards to avoid messing up indices
    let startIndexMonaco = -1;
    let endIndexMonaco = -1;
    while (i >= 0) {
      endIndexMonaco = actuallyDeletingIndices[i];
      let j = i - 1;
      while (
        j >= 0 &&
        actuallyDeletingIndices[j] + 1 === actuallyDeletingIndices[j + 1]
      ) {
        j--;
      }
      startIndexMonaco = actuallyDeletingIndices[j + 1];
      i = j;

      // Delete from the screen
      EditorService.remoteOpLeft++; // Avoid triggering monaco change event

      // main Editor
      this.deleteTextFromMonacoByIndices(
        editorTextModel,
        startIndexMonaco,
        endIndexMonaco + 1
      );

      // Calculate new pos for nameTag after remote remove
      const deleteLength = endIndexMonaco - startIndexMonaco + 1;
      this.cursorService.recalculateAllNameTagAndCursorIndicesAfterRemove(
        startIndexMonaco,
        deleteLength
      );

      // aux Editor
      this.deleteTextFromMonacoByIndices(
        auxEditorTextModel,
        startIndexMonaco,
        endIndexMonaco + 1
      );
    }

    // Actually redraw nameTag
    this.cursorService.redrawPeersNameTagsAndCursors(editor);
  }

  // handleRedo(editor: any, auxEditor: any, fromPeerId: string) {}

  handleUndo(editor: any, auxEditor: any, fromPeerId: string) {
    const undos = this.undoStack.popTillStop();
    const noMoreUndos = undos === null;
    if (noMoreUndos) {
      return;
    }

    for (let i = 0; i < undos.length; i++) {
      const currentUndo = undos[i];
      const isUndoInsert = currentUndo.editType === EditType.Insert;
      if (isUndoInsert) {
        this.handleRemoteRemove(editor, auxEditor, currentUndo.edit);
        this.tellPeerServerToBroadcast(currentUndo.edit, false);
      } else {
        this.handleRemoteInsert(
          editor,
          auxEditor,
          currentUndo.edit,
          fromPeerId
        );
        this.tellPeerServerToBroadcast(currentUndo.edit, true);
      }
    }
  }

  private tellPeerServerToBroadcast(crdts: CRDT[], isInsert: boolean) {
    // PeerService listens to this event at subscribeToEditorServiceEvents()
    this.crdtsToTransfer = crdts;
    this.crdtEvent.emit(isInsert);
  }

  private writeTextToMonacoAtIndex(
    editor: any,
    editorTextModel: any,
    text: string,
    startIndex: number
  ): void {
    const pos = this.indexToPos(editorTextModel, startIndex);
    this.writeTextToMonacoAtPos(
      editor,
      editorTextModel,
      text,
      pos.lineNumber,
      pos.column
    );
  }

  private deleteTextFromMonacoByIndices(
    editorTextModel: any,
    startIndex: number,
    endIndex: number
  ): void {
    const startPos = this.indexToPos(editorTextModel, startIndex);
    const endPos = this.indexToPos(editorTextModel, endIndex);
    this.deleteTextFromMonacoByPos(
      editorTextModel,
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    );
  }

  private deleteTextFromMonacoByPos(
    editorTextModel: any,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ): void {
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
          text: null,
        },
      ]
    );
  }

  private writeTextToMonacoAtPos(
    editor: any,
    editorTextModel: any,
    text: string,
    startLineNumber: number,
    startColumn: number
  ) {
    const selection = editor.getSelection();
    const selectionEndIndex = this.posToIndex(
      editorTextModel,
      selection.endLineNumber,
      selection.endColumn
    );
    const isTypingAtLeftEdge =
      startLineNumber === selection.startLineNumber &&
      startColumn === selection.startColumn;
    const isTypingAtRightEdge =
      startLineNumber === selection.endLineNumber &&
      startColumn === selection.endColumn;

    const range = new monaco.Range(
      startLineNumber,
      startColumn,
      startLineNumber,
      startColumn
    );
    editorTextModel.pushEditOperations(
      [],
      [
        {
          range: range,
          text: text,
          forceMoveMarkers: true,
        },
      ]
    );

    if (isTypingAtRightEdge) {
      // Do not grow our selection when typing at the right edge of that selection
      editor.setSelection(selection);
    } else if (isTypingAtLeftEdge) {
      // Grow our selection when typing at left edge
      const endIndex = selectionEndIndex + text.length;
      const endPos = this.indexToPos(editorTextModel, endIndex);
      const newSelectionRange = new monaco.Range(
        startLineNumber,
        startColumn,
        endPos.lineNumber,
        endPos.column
      );
      editor.setSelection(newSelectionRange);
    }
  }

  private indexToPos(editorTextModel: any, index: number): any {
    return editorTextModel.getPositionAt(index);
  }

  posToIndex(editorTextModel: any, lineNumber: number, column: number): number {
    return editorTextModel.getOffsetAt(new monaco.Position(lineNumber, column));
  }

  getOldCRDTsAsSortedArray(): CRDT[] {
    return this.bst.toSortedArray();
  }

  getCrdtsToTransfer() {
    return this.crdtsToTransfer;
  }

  /**
   * Classify important change events that needed to be applied right away such as mouse click
   */
  static isCursorOrSelectEventImportant(
    event: SelectionChangeInfo | CursorChangeInfo
  ): boolean {
    if (
      event.reason === CursorChangeReason.Explicit ||
      event.reason === CursorChangeReason.Redo ||
      event.reason === CursorChangeReason.Undo ||
      (event.source === CursorChangeSource.MOUSE_EVENT &&
        event.reason === CursorChangeReason.NotSet) ||
      event.source === CursorChangeSource.DRAG_AND_DROP_EVENT ||
      event.source === CursorChangeSource.CTRL_SHIFT_K_EVENT ||
      event.source === CursorChangeSource.CTRL_ENTER_EVENT ||
      event.source === CursorChangeSource.CTRL_SHIFT_ENTER_EVENT
    ) {
      return true;
    }
  }
}
