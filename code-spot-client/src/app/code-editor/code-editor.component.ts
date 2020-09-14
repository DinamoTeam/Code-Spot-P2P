import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { ActivatedRoute } from '@angular/router';
import { PeerService } from '../services/peer.service';
import { Location } from '@angular/common';
import { Languages } from '../shared/Languages';
import { AnnounceType } from '../shared/AnnounceType';
import { CursorService } from '../services/cursor.service';
import { PeerUtils, Utils } from '../shared/Utils';
import { AlertType } from '../shared/AlertType';
import { CursorChangeInfo } from '../shared/CursorChangeInfo';
import { SelectionChangeInfo } from '../shared/SelectionChangeInfo';

@Component({
  selector: 'app-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.css'],
})
export class CodeEditorComponent implements OnInit {
  showNameTags: boolean = true;
  showErrorBanner: boolean = false;
  ready = false;
  roomName: string;
  editor: any;
  auxEditor: any;
  editorTextModel: any;
  mainEditorReady = false;
  auxEditorReady = false;
  peerServiceHasConnectedToPeerServer = false;
  auxEditorTextModel: any;
  @Input() languages = Languages;
  themes = [
    { name: 'Visual Studio Dark', value: 'vs-dark' },
    { name: 'Visual Studio Light', value: 'vs' },
    { name: 'High Contrast Dark', value: 'hc-black' },
  ];
  selectedLang: string;
  selectedTheme: string;
  editorForm = new FormGroup({
    language: new FormControl(
      EditorService.currentLanguage,
      Validators.compose([Validators.required])
    ),
    theme: new FormControl(
      'vs-dark',
      Validators.compose([Validators.required])
    ),
  });

  constructor(
    private peerService: PeerService,
    private cursorService: CursorService,
    public editorService: EditorService,
    private ngZone: NgZone,
    private actRoute: ActivatedRoute,
    private location: Location
  ) {
    this.subscribeToPeerServiceEvents();
    this.getRoomName();
  }

  ngOnInit() {
    this.selectedLang = EditorService.currentLanguage;
    this.selectedTheme = 'vs-dark';
  }

  editorOptions = {
    theme: 'vs-dark',
    language: EditorService.currentLanguage,
    wordWrap: 'on',
    trimAutoWhitespace: false,
  };

  onLanguageChange(res: string) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);
    monaco.editor.setModelLanguage(this.editorTextModel, this.selectedLang);
    EditorService.currentLanguage = this.selectedLang;
    this.peerService.broadcastChangeLanguage();
    Utils.alert(
      'Language has been changed to ' +
        Utils.getLanguageName(EditorService.currentLanguage),
      AlertType.Message
    );
  }

  onThemeChange(res: string) {
    this.selectedTheme = res.slice(res.indexOf(':') + 2);
    monaco.editor.setTheme(this.selectedTheme);
  }

  toggleNameTag() {
    if (this.showNameTags) this.cursorService.showAllNameTags();
    else this.cursorService.hideAllNameTags();
  }

  onInitEditorHandler(event: any) {
    this.editor = event;
    this.editorTextModel = this.editor.getModel();
    this.editorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'

    // Disable Ctrl-D (tricky to sync cursor + select)
    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_D,
      function () {}
    );

    // Add "padding" to the top
    let viewZoneId;
    this.editor.changeViewZones((changeAccessor) => {
      var domNode = document.createElement('div');
      viewZoneId = changeAccessor.addZone({
        afterLineNumber: 0,
        heightInLines: 1.5,
        domNode: domNode,
      });
    });

    // Listen to any content changes (such as insert, remove, undo,...)
    this.editor.onDidChangeModelContent((e: any) =>
      this.onDidChangeModelContentHandler(e)
    );

    // Listen to cursor position change
    this.editor.onDidChangeCursorPosition((e: any) =>
      this.onDidChangeCursorPositionHandler(e)
    );

    // Listen to cursor selection change
    this.editor.onDidChangeCursorSelection((e: any) =>
      this.onDidChangeCursorSelectionHandler(e)
    );

    // Only connect to PeerServer when both Monaco Editors is ready
    this.mainEditorReady = true;
    if (this.auxEditorReady && !this.peerServiceHasConnectedToPeerServer) {
      this.peerService.connectToPeerServerAndInit();
      this.peerServiceHasConnectedToPeerServer = true;
    }
  }

  /**
   * Aux editor will always be '1 step behind' main editor. This is useful because
   * to correctly sync undo / redo request and cursor / select change request,
   * we need 'currentState' and 'previousState' of our editor
   */
  onInitAuxEditorHandler(event: any) {
    this.auxEditor = event;
    this.auxEditorTextModel = this.auxEditor.getModel();
    this.auxEditorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'

    // Only connect to PeerServer when both Monaco Editors is ready
    this.auxEditorReady = true;
    if (this.mainEditorReady && !this.peerServiceHasConnectedToPeerServer) {
      this.peerService.connectToPeerServerAndInit();
      this.peerServiceHasConnectedToPeerServer = true;
    }
  }

  /**
   * Listen to any content changes (such as insert, remove, undo,...)
   */
  onDidChangeModelContentHandler(event: any): void {
    // remoteOpLeft is used because remoteInsert / remoteRemove will also trigger this event
    if (EditorService.remoteOpLeft > 0) {
      EditorService.remoteOpLeft--;
      return;
    }
    const changes = event.changes;

    for (let i = 0; i < changes.length; i++) {
      const range = changes[i].range;

      // Calculate new pos for nameTag when local remove. Notice we use auxEditor
      let index = this.editorService.posToIndex(
        this.auxEditorTextModel,
        range.startLineNumber,
        range.startColumn
      );
      this.cursorService.recalculateAllNameTagAndCursorIndicesAfterRemove(
        index,
        changes[i].rangeLength
      );

      // Handle local remove (if any)
      this.editorService.handleLocalRemove(
        this.auxEditor,
        range.startLineNumber,
        range.startColumn,
        range.endLineNumber,
        range.endColumn,
        changes[i].rangeLength
      );

      // Calculate new pos for nameTag when local insert. Notice we use auxEditor
      index = this.editorService.posToIndex(
        this.auxEditorTextModel,
        range.startLineNumber,
        range.startColumn
      );
      this.cursorService.recalculateAllNameTagAndCursorIndicesAfterInsert(
        index,
        changes[i].text.length,
        this.peerService.getMyPeerId()
      );

      // Handle local insert (if any)
      this.editorService.handleLocalInsert(
        this.auxEditor,
        changes[i].text,
        range.startLineNumber,
        range.startColumn
      );
    }

    // Redraw name tag
    this.cursorService.redrawPeersNameTagsAndCursors(this.editor);
  }

  /**
   * Listen to cursor position change event
   */
  onDidChangeCursorPositionHandler(event: any): void {
    this.cursorService.setMyLastCursorEvent(event);

    // Draw our name tag wherever our cursor goes
    this.cursorService.drawNameTag(
      this.editor,
      this.peerService.getMyPeerId(),
      event.position.lineNumber,
      event.position.column,
      true
    );

    this.peerService.broadcastChangeCursorPos(event);
  }

  /**
   * Listen to cursor selection change event
   */
  onDidChangeCursorSelectionHandler(event: any): void {
    this.cursorService.setMyLastSelectEvent(event);
    this.peerService.broadcastChangeSelectionPos(event);
  }

  subscribeToPeerServiceEvents(): void {
    PeerUtils.announce.subscribe((message: any) => {
      this.ngZone.run(() => {
        switch (message) {
          case AnnounceType.RemoteInsert:
          case AnnounceType.RemoteAllMessages:
            this.editorService.handleRemoteInsert(
              this.editor,
              this.auxEditor,
              this.peerService.getReceivedRemoteCrdts(),
              this.peerService.getPeerIdWhoSentCrdts()
            );
            break;
          case AnnounceType.RemoteRemove:
            this.editorService.handleRemoteRemove(
              this.editor,
              this.auxEditor,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case AnnounceType.RoomName:
            this.roomName = this.peerService.getRoomName();
            this.location.replaceState('/editor/' + this.roomName);
            break;
          case AnnounceType.ChangeLanguage:
            this.selectedLang = EditorService.currentLanguage;
            monaco.editor.setModelLanguage(
              this.editorTextModel,
              this.selectedLang
            );
            this.editorForm.patchValue({ language: this.selectedLang });
            break;
          case AnnounceType.ReadyToDisplayMonaco:
            this.ready = true;
            break;

          /**
           * Sync cursor, name tag and selection.
           *
           * To sync the 3 things above, we have 3 options. The first 2 don't work, the last one works quite well:
           *
           * 1/ Send all change events and update when receive those events: NOT GOOD because if 2 peers are far apart,
           * there will be a noticeable delay
           * 2/ Update based on our own calculation after each insertion, deletion and with the help of Monaco decoration: NOT GOOD
           * because if the other peer click somewhere, how can we calculate that?
           * => Maybe we can combine the best of both worlds? YES we can, with some 'tricks'.
           * - We CANNOT send all change events, execute them all and also update based on our calculation. The cursor will go crazy
           * - Adding some logic such as only send 'important' events such as mouse click is NOT enough (There are edge cases)
           *
           * Here's what we CAN do (and this is what we're doing right now):
           * 3/ - Send ALL events to make sure the cursor, nametag and selection will EVENTUALLY be correct (after 2-3 seconds idle)
           * - Then during those 2-3 seconds when cursors,... are possibly not in sync, use our calculation + monaco to make it
           * correct AS MUCH AS POSSIBLE
           * - Also we will NOT use MOST change events received. We only use the 'most recent' one if
           * it has been 500 milliseconds and the cursor doesn't move
           * - Finally, for important events such as mouse click, user explicitly move cursor by keyboard arrow and
           * tricky-to-calculate events such as undo, redo, some Monaco shortcuts, we execute as soon as we receive them
           */
          case AnnounceType.CursorChange:
            const cursorChangeInfo = this.peerService.getCursorChangeInfo();
            this.cursorService.setPeerMostRecentCursorChange(
              cursorChangeInfo.peerId,
              cursorChangeInfo
            );

            if (
              EditorService.isCursorOrSelectEventImportant(cursorChangeInfo)
            ) {
              // Apply change right now
              this.updateCursorAndNameTag(cursorChangeInfo);
            } else {
              // Decide after ... milliseconds
              this.useEventToUpdateCursorAndNameTagIfNoMoreChangesAfter(
                500,
                cursorChangeInfo,
                cursorChangeInfo.peerId
              );
            }
            break;
          case AnnounceType.SelectionChange:
            const selectionChangeInfo = this.peerService.getSelectionChangeInfo();
            this.cursorService.setPeerMostRecentSelectEvent(
              selectionChangeInfo.peerId,
              selectionChangeInfo
            );

            if (
              EditorService.isCursorOrSelectEventImportant(selectionChangeInfo)
            ) {
              // Apply change right now
              this.updateSelection(selectionChangeInfo);
            } else {
              // Decide after ... milliseconds
              this.useEventToUpdateSelectIfNoMoreChangesAfter(
                500,
                selectionChangeInfo,
                selectionChangeInfo.peerId
              );
            }
            break;

          case AnnounceType.PeerLeft:
            const peerIdLeft = this.peerService.getPeerIdJustLeft();
            this.cursorService.removePeer(this.editor, peerIdLeft);
            break;
          case AnnounceType.ChangePeerName:
            this.cursorService.redrawPeersNameTagsAndCursors(this.editor);
            break;
          case AnnounceType.ChangeMyName:
            this.cursorService.redrawMyNameTag(
              this.editor,
              this.peerService.getMyPeerId()
            );
            break;
          case AnnounceType.UnhandledError:
            this.showErrorBanner = true;
          default:
            break;
        }
      });
    });
  }

  private useEventToUpdateCursorAndNameTagIfNoMoreChangesAfter(
    milliseconds: number,
    cursorChangeEvent: CursorChangeInfo,
    peerId: string
  ) {
    const that = this;
    setTimeout(() => {
      const isEventMostRecent =
        that.cursorService.getPeerMostRecentCursorEvent(peerId) ===
        cursorChangeEvent;

      if (isEventMostRecent) {
        that.updateCursorAndNameTag(cursorChangeEvent);
      }
    }, milliseconds);
  }

  private useEventToUpdateSelectIfNoMoreChangesAfter(
    milliseconds: number,
    selectChangeEvent: SelectionChangeInfo,
    peerId: string
  ) {
    const that = this;
    setTimeout(() => {
      const isEventMostRecent =
        that.cursorService.getPeerMostRecentSelectEvent(peerId) ===
        selectChangeEvent;

      if (isEventMostRecent) {
        that.updateSelection(selectChangeEvent);
      }
    }, milliseconds);
  }

  private updateCursorAndNameTag(cursorChangeEvent: CursorChangeInfo) {
    this.cursorService.drawCursor(
      this.editor,
      cursorChangeEvent.peerId,
      cursorChangeEvent.line,
      cursorChangeEvent.col
    );

    this.cursorService.drawNameTag(
      this.editor,
      cursorChangeEvent.peerId,
      cursorChangeEvent.line,
      cursorChangeEvent.col,
      false
    );
  }

  private updateSelection(selectionChangeEvent: SelectionChangeInfo) {
    this.cursorService.drawSelection(
      this.editor,
      selectionChangeEvent.startLine,
      selectionChangeEvent.startColumn,
      selectionChangeEvent.endLine,
      selectionChangeEvent.endColumn,
      selectionChangeEvent.peerId
    );
  }

  getRoomName(): void {
    this.peerService.connectionEstablished.subscribe((successful: boolean) => {
      if (successful) {
        this.roomName = this.actRoute.snapshot.params['roomName'];
        if (this.roomName === 'new') this.peerService.createNewRoom();
        else this.peerService.joinExistingRoom(this.roomName);
      }
    });
  }

  copyLink(): void {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value =
      window.location.protocol +
      '//' +
      window.location.hostname +
      '/editor/' +
      this.roomName;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
    Utils.alert('Link copied to clipboard!', AlertType.Success);
  }

  downloadFile(): void {
    const text = this.editorService.getEditorContent(this.editor);
    const elem = document.createElement('a');
    const fileName = 'codeSpot' + Utils.getLanguageExt(EditorService.currentLanguage);
    elem.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    elem.setAttribute('download', fileName);
    elem.style.display = 'none';
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }

  printBST() {
    console.log(this.editorService.bst.inorderToString());
  }
}
