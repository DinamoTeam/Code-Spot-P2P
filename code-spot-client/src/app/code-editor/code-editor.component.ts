import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { MessageService, MessageType } from '../services/message.service';
import { Message } from '../shared/Message';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

declare const monaco: any;

@Component({
  selector: 'app-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.css'],
})
export class CodeEditorComponent implements OnInit {
  roomName: string;
  editor: any;
  editorTextModel: any;
  remoteOpLeft: number = 0;
  allMessages: string[] = null;
  selectedLang: string;
  languageForm = new FormGroup({
    language: new FormControl('cpp', Validators.compose([Validators.required])),
  });

  constructor(
    public editorService: EditorService,
    private messageService: MessageService,
    private ngZone: NgZone,
    private actRoute: ActivatedRoute,
    private location: Location
  ) {
    this.subscribeToSignalrEvents();
    this.getRoomName();
  }

  ngOnInit() {
    this.selectedLang = 'cpp';
    this.allMessages = null;
  }

  @Input() languages = [
    { name: 'C++', value: 'cpp' },
    { name: 'C#', value: 'csharp' },
    { name: 'Java', value: 'java' },
    { name: 'Python', value: 'python' },
    { name: 'JavaScript', value: 'javascript' },
  ];

  editorOptions = { theme: 'vs-dark', language: 'cpp' };
  code: string = 'function x() {\nconsole.log("Hello world!");\n}';

  onLanguageChange(res) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);

    if (this.selectedLang === 'cpp') {
      this.editorOptions = Object.assign({}, this.editorOptions, {
        language: 'cpp',
      });
    } else if (this.selectedLang === 'javascript') {
      this.editorOptions = Object.assign({}, this.editorOptions, {
        language: 'javascript',
      });
    } else if (this.selectedLang === 'csharp') {
      this.editorOptions = Object.assign({}, this.editorOptions, {
        language: 'csharp',
      });
    } else if (this.selectedLang === 'java') {
      this.editorOptions = Object.assign({}, this.editorOptions, {
        language: 'java',
      });
    } else if (this.selectedLang === 'python') {
      this.editorOptions = Object.assign({}, this.editorOptions, {
        language: 'python',
      });
    }
  }

  onInitHandler(event: any) {
    this.editor = event;
    this.editorTextModel = this.editor.getModel();
    this.editorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'

    this.editor.onDidChangeModelContent((e: any) =>
      this.onDidChangeModelContentHandler(e)
    );

    if (this.allMessages != null) {
      this.editorService.handleAllMessages(
        this.editorTextModel,
        this.allMessages
      );
      this.allMessages = null;
    }
  }

  onDidChangeModelContentHandler(event: any): void {
    //console.log('RemoteOpLeft: ' + this.remoteOpLeft);
    if (this.remoteOpLeft > 0) {
      this.remoteOpLeft--;
      return;
    }

    //console.log(event);

    const isUndo = event.isUndoing;
    const isRedo = event.isRedoing;

    if (isUndo) {
      let changes = event.changes;
      //console.log(changes);
      for (var i = 0; i < changes.length; i++) {
        let range = changes[i].range;
        this.editorService.handleLocalRangeRemove(
          this.editorTextModel,
          range.startLineNumber,
          range.startColumn,
          changes[i].rangeLength,
          this.roomName
        );
      }
      return;
    }

    if (isRedo) {
      let changes = event.changes;
      //console.log(changes);
      for (var i = 0; i < changes.length; i++) {
        let range = changes[i].range;
        this.editorService.handleLocalRangeInsert(
          this.editorTextModel,
          changes[i].text,
          range.startLineNumber,
          range.startColumn,
          this.roomName
        );
      }
      return;
    }

    const change = event.changes[0];
    const rangeDetails = change.range;
    const rangeLen = change.rangeLength;
    // The new text for the range (! \n can't see)
    const newText = change.text;
    //console.log('Range Len: ' + rangeLen);
    //console.log('New text: |' + newText + '|');
    //console.log(rangeDetails);

    // Handle remove if any
    if (rangeLen > 0) {
      this.editorService.handleLocalRangeRemove(
        this.editorTextModel,
        rangeDetails.startLineNumber,
        rangeDetails.startColumn,
        rangeLen,
        this.roomName
      );
    }

    // Handle insert if any
    if (newText !== '') {
      this.editorService.handleLocalRangeInsert(
        this.editorTextModel,
        newText,
        rangeDetails.startLineNumber,
        rangeDetails.startColumn,
        this.roomName
      );
    }
  }

  subscribeToSignalrEvents(): void {
    this.messageService.messageReceived.subscribe((message: Message) => {
      this.ngZone.run(() => {
        const messageType = message.type;
        switch (messageType) {
          case MessageType.SiteId:
            const siteId = parseInt(message.messages[0], 10);
            EditorService.setSiteId(siteId);
            break;
          case MessageType.RoomName:
            this.roomName = message.messages[0];
            this.location.replaceState('/editor/' + this.roomName);
            break;
          case MessageType.RemoteRangeInsert:
            this.remoteOpLeft = message.messages.length;
            this.editorService.handleRemoteRangeInsert(
              this.editorTextModel,
              message.messages
            );
            break;
          case MessageType.RemoteRangeRemove:
            this.remoteOpLeft = message.messages.length;
            this.editorService.handleRemoteRangeRemove(
              this.editorTextModel,
              message.messages
            );
            break;
          case MessageType.AllMessages:
            this.remoteOpLeft = message.messages.length;

            // Duplicate tab or refresh tab don't generate new editorTextModel
            if (this.editorTextModel === undefined) {
              this.allMessages = message.messages;
            } else {
              this.editorService.handleAllMessages(
                this.editorTextModel,
                message.messages
              );
            }
            break;
          default:
            console.log('UNHANDLED MESSAGES!');
            console.log(message);
            break;
        }
      });
    });
  }

  getRoomName(): void {
    this.messageService.connectionEstablished.subscribe(
      (successful: boolean) => {
        if (successful) {
          this.roomName = this.actRoute.snapshot.params['roomName'];
          if (this.roomName == 'NONE')
            this.messageService.sendSignalCreateNewRoom();
          else {
            this.messageService.sendSignalJoinExistingRoom(this.roomName);
          }
        }
      }
    );
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

    this.showSuccessAlert = true;
  }

  closeAlert() {
    this.showSuccessAlert = false;
  }
}
