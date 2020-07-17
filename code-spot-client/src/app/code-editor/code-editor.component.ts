import {
  Component,
  OnInit,
  Input,
  NgZone,
  EventEmitter,
  Inject,
} from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { ActivatedRoute } from '@angular/router';
import { PeerService } from '../services/peer.service';
import { Location, DOCUMENT } from '@angular/common';
import { Languages } from './languages';
import { BroadcastInfo } from '../shared/BroadcastInfo';
import { CursorService } from '../services/cursor.service';
import { PeerUtils } from '../shared/Utils';

declare const monaco: any;

@Component({
  selector: 'app-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.css'],
})
export class CodeEditorComponent implements OnInit {
  // Monaco cursor select
  selectDecorations = [];
  cursorDecorations = [];

  ready = false;
  roomName: string;
  editor: any;
  auxEditor: any;
  editorTextModel: any;
  mainEditorReady = false;
  auxEditorReady = false;
  peerServiceHasConnectedToPeerServer = false;
  auxEditorTextModel: any;
  allMessages: string[] = null;
  selectedLang: string;
  languageForm = new FormGroup({
    language: new FormControl(
      EditorService.language,
      Validators.compose([Validators.required])
    ),
  });

  constructor(
    private peerService: PeerService,
    private cursorService: CursorService,
    public editorService: EditorService,
    private ngZone: NgZone,
    private actRoute: ActivatedRoute,
    private location: Location,
    @Inject(DOCUMENT) document
  ) {
    this.subscribeToPeerServiceEvents();
    this.getRoomName();
  }

  ngOnInit() {
    this.selectedLang = EditorService.language;
    this.allMessages = null;
  }

  @Input() languages = Languages;

  editorOptions = {
    theme: 'vs-dark',
    language: EditorService.language,
    stickiness: 1,
  };

  onLanguageChange(res) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);
    this.editorOptions = Object.assign({}, this.editorOptions, {
      language: this.selectedLang,
    });

    EditorService.language = this.selectedLang;
    this.peerService.broadcastChangeLanguage();
  }

  onInitEditorHandler(event: any) {
    console.log(event);
    console.log('yehh');
    this.editor = event;
    this.editorTextModel = this.editor.getModel();
    this.editorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'

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
    // Handle all remove and insert requests
    for (let i = 0; i < changes.length; i++) {
      const range = changes[i].range;
      this.editorService.handleLocalRangeRemove(
        this.auxEditorTextModel,
        range.startLineNumber,
        range.startColumn,
        range.endLineNumber,
        range.endColumn,
        changes[i].rangeLength
      );
      this.editorService.handleLocalRangeInsert(
        this.auxEditorTextModel,
        changes[i].text,
        range.startLineNumber,
        range.startColumn
      );
    }
  }

  onDidChangeCursorPositionHandler(event: any): void {
    console.log('Cursor Change:');
    console.log(event);
    this.cursorService.setMyLastCursorEvent(event);
    // 3: Explicit - There was an explicit user gesture.
    if (event.reason === 3 ||
       (event.source === 'mouse' && event.reason === 0) || // mouse click elsewhere after select
       (event.source === 'editor.contrib.dragAndDrop')     // drag and drop
       ) {
      this.peerService.broadcastChangeCursorPos(event);
    }
  }

  onDidChangeCursorSelectionHandler(event: any): void {
    console.log('Select Change:');
    console.log(event);
    this.cursorService.setMyLastSelectEvent(event);
    if (event.reason === 3 ||
       (event.source === 'mouse' && event.reason === 0) ||
       (event.source === 'editor.contrib.dragAndDrop')
       ) {
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
            this.languageForm.patchValue({ language: this.selectedLang });
            break;
          case BroadcastInfo.RemoteInsert:
            this.editorService.handleRemoteRangeInsert(
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case BroadcastInfo.RemoteRemove:
            this.editorService.handleRemoteRangeRemove(
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case BroadcastInfo.RemoteAllMessages:
            this.editorService.handleAllMessages(
              this.editorTextModel,
              this.auxEditorTextModel,
              this.peerService.getReceivedRemoteCrdts()
            );
            break;
          case BroadcastInfo.ReadyToDisplayMonaco:
            this.ready = true;
            break;
          case BroadcastInfo.UpdateChatMessages:
            break;
          case BroadcastInfo.CursorChange:
            const cursorChange = this.peerService.getCursorChangeInfo();
            this.cursorService.drawCursor(
              this.editor,
              cursorChange.line,
              cursorChange.col,
              cursorChange.peerId
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
          default:
            console.log('UNKNOWN event!!!');
            console.log(message);
        }
      });
    });
  }

  getRoomName(): void {
    this.peerService.connectionEstablished.subscribe((successful: boolean) => {
      if (successful) {
        this.roomName = this.actRoute.snapshot.params['roomName'];
        if (this.roomName === 'NONE') {
          this.peerService.createNewRoom();
        } else {
          this.peerService.joinExistingRoom(this.roomName);
        }
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

    alert("Link copied to clipboard!");

    // TODO: Fix the box!!!
    //this.showSuccessAlert = true;
  }

  closeAlert() {
    this.showSuccessAlert = false;
  }


  printSelect() {
    console.log(this.cursorService.getMyLastSelectEvent());
  }

  printCursor() {
    console.log(this.cursorService.getMyLastCursorEvent());
  }
}
