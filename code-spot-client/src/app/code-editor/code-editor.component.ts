import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { PeerService, BroadcastInfo } from '../services/peer.service';

declare const monaco: any;

@Component({
  selector: 'app-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.css'],
})
export class CodeEditorComponent implements OnInit {
  roomName: string;
  editor: any;
  auxEditor: any;
  editorTextModel: any;
  auxEditorTextModel: any;
  allMessages: string[] = null;
  selectedLang: string;
  languageForm = new FormGroup({
    language: new FormControl('cpp', Validators.compose([Validators.required])),
  });

  constructor(
    private peerService: PeerService,
    public editorService: EditorService,
    private ngZone: NgZone,
    private actRoute: ActivatedRoute,
    private location: Location
  ) {
    this.subscribeToPeerServiceEvents();
    this.getRoomName();
    // this.subscribeToSignalrEvents();
  }

  ngOnInit() {
    this.selectedLang = 'cpp';
    this.allMessages = null;
  }

  @Input() languages = [
    { name: 'Bat', value: 'bat' },
    { name: 'C', value: 'c' },
    { name: 'C++', value: 'cpp' },
    { name: 'C#', value: 'csharp' },
    { name: 'Go', value: 'go' },
    { name: 'HTML', value: 'html' },
    { name: 'Java', value: 'java' },
    { name: 'Kotlin', value: 'kotlin' },
    { name: 'MySQL', value: 'mysql' },
    { name: 'JavaScript', value: 'javascript' },
    { name: 'PgSQL', value: 'pgsql' },
    { name: 'Plain Text', value: 'plaintext' },
    { name: 'Python', value: 'python' },
    { name: 'Ruby', value: 'ruby' },
    { name: 'Scheme', value: 'scheme' },
    { name: 'Shell', value: 'shell' },
    { name: 'SQL', value: 'sql' },
    { name: 'Swift', value: 'swift' },
    { name: 'Typescript', value: 'typescript' },
  ];

  editorOptions = { theme: 'vs-dark', language: 'cpp' };

  onLanguageChange(res) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);
    this.editorOptions = Object.assign({}, this.editorOptions, {
      language: this.selectedLang,
    });
  }

  onInitEditorHandler(event: any) {
    this.editor = event;
    this.editorTextModel = this.editor.getModel();
    this.editorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'

    this.editor.onDidChangeModelContent((e: any) =>
      this.onDidChangeModelContentHandler(e)
    );

    // Moved to PeerService
    /*if (this.allMessages != null) {
      this.editorService.handleAllMessages(
        this.editorTextModel,
        this.auxEditorTextModel,
        this.allMessages
      );
      this.allMessages = null;
    }*/
  }

  onInitAuxEditorHandler(event: any) {
    this.auxEditor = event;
    this.auxEditorTextModel = this.auxEditor.getModel();
    this.auxEditorTextModel.setEOL(0); // Set EOL from '\r\n' -> '\n'
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

  subscribeToPeerServiceEvents(): void {
    this.peerService.infoBroadcasted.subscribe((message: any) => {
      this.ngZone.run(() => {
        if (message === BroadcastInfo.RoomName) {
          this.roomName = this.peerService.getRoomName();
          this.location.replaceState("/editor/" + this.roomName);
        }
      });
    });

    this.peerService.getRemoteInsertObservable().subscribe(
      (crdts) => {
        console.log('Catch a remote insert event');
        this.editorService.handleRemoteRangeInsert(
          this.editorTextModel,
          this.auxEditorTextModel,
          crdts
        );
      },
      (error) => {
        console.error(error);
      }
    );

    this.peerService.getRemoteRemoveObservable().subscribe(
      (crdts) => {
        console.log('Catch a remote remote event');
        this.editorService.handleRemoteRangeRemove(
          this.editorTextModel,
          this.auxEditorTextModel,
          crdts
        );
      },
      (error) => {
        console.log(error);
      }
    );

    this.peerService.getAllMessagesObservable().subscribe(
      (crdts) => {
        console.log('Catch all messages event');
        this.editorService.handleAllMessages(
          this.editorTextModel,
          this.auxEditorTextModel,
          crdts
        );
      },
      (error) => {
        console.log(error);
      }
    );
  }

  /*subscribeToSignalrEvents(): void {
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
          case MessageType.Language:
            this.selectedLang = message.messages[0];
            this.editorOptions = Object.assign({}, this.editorOptions, {
              language: this.selectedLang,
            });
            this.languageForm.patchValue({ language: this.selectedLang });
            break;
          case MessageType.RemoteRangeInsert:
            // RemoteOpLeft will be set inside handleRemoteRangeInsert
            this.editorService.handleRemoteRangeInsert(
              this.editorTextModel,
              this.auxEditorTextModel,
              message.messages
            );
            break;
          case MessageType.RemoteRangeRemove:
            this.editorService.handleRemoteRangeRemove(
              this.editorTextModel,
              this.auxEditorTextModel,
              message.messages
            );
            break;
          case MessageType.AllMessages:
            // Duplicate tab or refresh tab don't generate new editorTextModel
            if (this.editorTextModel === undefined) {
              this.allMessages = message.messages;
            } else {
              this.editorService.handleAllMessages(
                this.editorTextModel,
                this.auxEditorTextModel,
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
  }*/

  getRoomName(): void {
    this.peerService.connectionEstablished.subscribe((successful: boolean) => {
      if (successful) {
        this.roomName = this.actRoute.snapshot.params["roomName"];
        if (this.roomName == "NONE") {
          this.peerService.createNewRoom();
        } else {
          this.peerService.joinExistingRoom(this.roomName);
        }
      }
    });
  }

  /*getRoomName(): void {
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
  }*/

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
