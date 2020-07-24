import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { ActivatedRoute } from '@angular/router';
import { PeerService } from '../services/peer.service';
import { Location } from '@angular/common';
import { Languages } from './languages';
import { BroadcastInfo } from '../shared/BroadcastInfo';
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
  // Monaco cursor select
  selectDecorations = [];
  cursorDecorations = [];

  showNameTags: boolean = true;
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

  editorOptions = {
    theme: 'vs-dark',
    language: EditorService.language,
    stickiness: 1,
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

    this.editor.onDidChangeModelContent((e: any) =>
      this.onDidChangeModelContentHandler(e)
    );

    this.editor.onDidChangeCursorPosition((e: any) =>
      this.onDidChangeCursorPositionHandler(e)
    );

    this.editor.onDidChangeCursorSelection((e: any) =>
      this.onDidChangeCursorSelectionHandler(e)
    );

    this.mainEditorReady = true;
    if (this.auxEditorReady && !this.peerServiceHasConnectedToPeerServer) {
      this.peerService.connectToPeerServerAndInit();
      this.peerServiceHasConnectedToPeerServer = true;
    }
  }

  onInitAuxEditorHandler(event: any) {
    this.auxEditor = event;
    this.auxEditorTextModel = this.auxEditor.getModel();
    this.auxEditorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'

    this.auxEditorReady = true;
    if (this.auxEditorReady && !this.peerServiceHasConnectedToPeerServer) {
      this.peerService.connectToPeerServerAndInit();
      this.peerServiceHasConnectedToPeerServer = true;
    }
  }

  onDidChangeModelContentHandler(event: any): void {
    if (EditorService.remoteOpLeft > 0) {
      EditorService.remoteOpLeft--;
      return;
    }

    const changes = event.changes;

    for (let i = 0; i < changes.length; i++) {
      const range = changes[i].range;

      // Calculate new pos for nameTag when local remove
      let index = this.editorService.posToIndex(
        this.auxEditor.getModel(),
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

      // Calculate new pos for nameTag when local insert
      index = this.editorService.posToIndex(
        this.auxEditor.getModel(),
        range.startLineNumber,
        range.startColumn
      );
      this.cursorService.recalculateAllNameTagIndicesAfterInsert(
        index,
        changes[i].text.length
      );

      // Handle local insert (if any)
      this.editorService.handleLocalRangeInsert(
        this.auxEditorTextModel,
        changes[i].text,
        range.startLineNumber,
        range.startColumn
      );
    }

    // Actually redraw name tag
    this.cursorService.redrawAllNameTags(this.editor);
  }

  onDidChangeCursorPositionHandler(event: any): void {
    this.cursorService.setMyLastCursorEvent(event);

    // Draw my name tag
    this.cursorService.drawNameTag(
      this.editor,
      this.peerService.getPeerId(),
      event.position.lineNumber,
      event.position.column,
      true
    );

    if (
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

  onDidChangeCursorSelectionHandler(event: any): void {
    this.cursorService.setMyLastSelectEvent(event);
    if (this.worthSending(event)) {
      this.peerService.broadcastChangeSelectionPos(event);
    }
  }

  subscribeToPeerServiceEvents(): void {
    PeerUtils.broadcast.subscribe((message: any) => {
      this.ngZone.run(() => {
        switch (message) {
          case BroadcastInfo.RoomName:
            this.roomName = this.peerService.getRoomName();
            this.location.replaceState('/editor/' + this.roomName);
            break;
          case BroadcastInfo.ChangeLanguage:
            this.selectedLang = EditorService.language;
            this.editorOptions = Object.assign({}, this.editorOptions, {
              language: this.selectedLang,
            });
            this.editorForm.patchValue({ language: this.selectedLang });
            break;
          case BroadcastInfo.RemoteInsert:
          case BroadcastInfo.RemoteAllMessages:
            this.editorService.handleRemoteRangeInsert(
              this.editor,
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case BroadcastInfo.RemoteRemove:
            this.editorService.handleRemoteRangeRemove(
              this.editor,
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case BroadcastInfo.ReadyToDisplayMonaco:
            this.ready = true;
            break;
          case BroadcastInfo.CursorChange:
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
          case BroadcastInfo.SelectionChange:
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
          case BroadcastInfo.PeerLeft:
            const peerIdLeft = this.peerService.getPeerIdJustLeft();
            this.cursorService.removePeer(this.editor, peerIdLeft);
            break;
          default:
        }
      });
    });
  }

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
        if (this.roomName === 'NONE') this.peerService.createNewRoom();
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

  printSelect() {
    console.log(this.cursorService.getMyLastSelectEvent());
  }

  printCursor() {
    console.log(this.cursorService.getMyLastCursorEvent());
  }
}
