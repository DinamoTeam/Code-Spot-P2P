import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { ActivatedRoute } from '@angular/router';
import { PeerService } from '../services/peer.service';
import { Location } from '@angular/common';
import { Languages } from './languages';
import { AnnounceType } from '../shared/AnnounceType';
import { CursorService } from '../services/cursor.service';
import { PeerUtils, Utils } from '../shared/Utils';
import { CursorChangeReason } from '../shared/CursorChangeReason';
import { CursorChangeSource } from '../shared/CursorChangeSource';
import { AlertType } from '../shared/AlertType';

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
      EditorService.language,
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
    this.selectedLang = EditorService.language;
    this.selectedTheme = 'vs-dark';
  }

  // tslint:disable-next-line: member-ordering
  editorOptions = {
    theme: 'vs-dark',
    language: EditorService.language,
    wordWrap: 'on',

    // // Trying to disable deleting white spaces
    // autoClosingOvertype: 'never',
    // autoClosingBrackets: 'never',
    // autoClosingQuotes: 'never',
    // autoIndent: 'none',
    // autoSurround: 'never',
    // folding: false,
    // renderIndentGuides: false,
    // wrappingIndent: 'none',
    // disableMonospaceOptimizations: true
  };

  onLanguageChange(res: string) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);
    monaco.editor.setModelLanguage(this.editorTextModel, this.selectedLang);
    EditorService.language = this.selectedLang;
    this.peerService.broadcastChangeLanguage();
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
    console.log(event);
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
      this.cursorService.recalculateAllNameTagIndicesAfterRemove(
        index,
        changes[i].rangeLength
      );

      // Handle local remove (if any)
      this.editorService.handleLocalRangeRemove(
        this.auxEditorTextModel,
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
      this.cursorService.recalculateAllNameTagIndicesAfterInsert(
        index,
        changes[i].text.length
      );

      // Handle local insert (if any)
      this.editorService.handleLocalInsert(
        this.auxEditorTextModel,
        changes[i].text,
        range.startLineNumber,
        range.startColumn
      );
    }

    // Redraw name tag
    this.cursorService.redrawPeersNameTags(this.editor);
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

    if (
      true ||
      this.worthSending(event) ||
      this.cursorService.peerIdsNeverSendCursorTo.size > 0 ||
      this.cursorService.justJoinRoom
    ) {
      this.peerService.broadcastChangeCursorPos(event);

      // Handle edge cases when first join room
      this.cursorService.peerIdsNeverSendCursorTo.clear();
      if (this.cursorService.justJoinRoom) {
        setTimeout(() => (this.cursorService.justJoinRoom = false), 2000);
      }
    }
  }

  /**
   * Listen to cursor selection change event
   */
  onDidChangeCursorSelectionHandler(event: any): void {
    this.cursorService.setMyLastSelectEvent(event);
    if (this.worthSending(event)) {
      this.peerService.broadcastChangeSelectionPos(event);
    }
  }

  subscribeToPeerServiceEvents(): void {
    PeerUtils.announce.subscribe((message: any) => {
      this.ngZone.run(() => {
        switch (message) {
          case AnnounceType.RemoteInsert:
          case AnnounceType.RemoteAllMessages:
            this.editorService.handleRemoteInsert(
              this.editor,
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case AnnounceType.RemoteRemove:
            this.editorService.handleRemoteRangeRemove(
              this.editor,
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case AnnounceType.RoomName:
            this.roomName = this.peerService.getRoomName();
            this.location.replaceState('/editor/' + this.roomName);
            break;
          case AnnounceType.ChangeLanguage:
            this.selectedLang = EditorService.language;
            monaco.editor.setModelLanguage(
              this.editorTextModel,
              this.selectedLang
            );
            this.editorForm.patchValue({ language: this.selectedLang });
            break;
          case AnnounceType.ReadyToDisplayMonaco:
            this.ready = true;
            break;
          case AnnounceType.CursorChange:
            const cursorChange = this.peerService.getCursorChangeInfo();
            this.cursorService.drawCursor(
              this.editor,
              cursorChange.line,
              cursorChange.col,
              cursorChange.peerId
            );
            this.cursorService.drawNameTag(
              this.editor,
              cursorChange.peerId,
              cursorChange.line,
              cursorChange.col,
              false
            );
            break;
          case AnnounceType.SelectionChange:
            const selectionChange = this.peerService.getSelectionChangeInfo();
            this.cursorService.drawSelection(
              this.editor,
              selectionChange.startLine,
              selectionChange.startColumn,
              selectionChange.endLine,
              selectionChange.endColumn,
              selectionChange.peerId
            );
            break;
          case AnnounceType.PeerLeft:
            const peerIdLeft = this.peerService.getPeerIdJustLeft();
            this.cursorService.removePeer(this.editor, peerIdLeft);
            break;
          case AnnounceType.ChangePeerName:
            this.cursorService.redrawPeersNameTags(this.editor);
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

  /**
   * To sync cursor / select change event, we can send every single change that takes place.
   * BUT this is VERY SLOW. Therefore we only send change event if we have to. We let Monaco's decoration
   * and our function: recalculateAllNameTagIndicesAfterInsert/Remove takes care of the rest.
   */
  private worthSending(CursorOrSelectChangeEvent: any): boolean {
    if (
      CursorOrSelectChangeEvent.reason === CursorChangeReason.Explicit ||
      CursorOrSelectChangeEvent.reason === CursorChangeReason.Redo ||
      CursorOrSelectChangeEvent.reason === CursorChangeReason.Undo ||
      (CursorOrSelectChangeEvent.source === CursorChangeSource.MOUSE_EVENT &&
        CursorOrSelectChangeEvent.reason === CursorChangeReason.NotSet) ||
      CursorOrSelectChangeEvent.source ===
        CursorChangeSource.DRAG_AND_DROP_EVENT ||
      CursorOrSelectChangeEvent.source ===
        CursorChangeSource.CTRL_SHIFT_K_EVENT ||
      CursorOrSelectChangeEvent.source ===
        CursorChangeSource.CTRL_ENTER_EVENT ||
      CursorOrSelectChangeEvent.source ===
        CursorChangeSource.CTRL_SHIFT_ENTER_EVENT
    ) {
      return true;
    }
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

  showSuccessAlert: boolean = false;
  copyLink(): void {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = window.location.href;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
    Utils.alert('Link copied to clipboard!', AlertType.Success);
  }
}
