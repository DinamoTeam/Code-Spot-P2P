import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { MessageService, MessageType } from '../services/message.service';
import { Message } from '../shared/Message';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

declare const monaco: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  roomName: string;
  editor: any;
  editorTextModel: any;
  remoteOpLeft: number = 0;
  allMessages: string = null;
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

    this.editor.onDidPaste((e: any) => this.onDidPasteHandler(e));
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

  onDidPasteHandler(event: any) {
    const rangeDetails = event;
    //console.log('Pasted range' + rangeDetails);
    //console.log(rangeDetails);
  }

  onDidChangeModelContentHandler(event: any): void {
    if (this.remoteOpLeft > 0) {
      this.remoteOpLeft--;
      return;
    }

    const change = event.changes[0];

    // The range that got replaced
    const rangeDetails = change.range;

    // Length of the range that got replaced
    const rangeLen = change.rangeLength;

    // The new text for the range (! \n can't see)
    const newText = change.text;
    console.log('New text: |' + newText + '|');
    console.log(rangeDetails);

    // It's a remove event
    if (newText.length === 0) {
      this.editorService.handleLocalRemove(
        this.editorTextModel,
        rangeDetails.startLineNumber,
        rangeDetails.startColumn,
        this.roomName
      );
    } else if (newText.length === 1) {
      // It's insert char event
      this.editorService.handleLocalInsert(
        this.editorTextModel,
        newText,
        rangeDetails.endLineNumber,
        rangeDetails.endColumn,
        this.roomName
      );
    } else if (newText.length > 1) {
      // !!! It can be pasted / or use auto-suggest
      // TODO: handle auto-suggest
      this.handlePasteEvent(
        newText,
        rangeDetails.endLineNumber,
        rangeDetails.endColumn
      );
    }
  }

  handlePasteEvent(text: string, endLineNumber: number, endColumn: number) {
    const letters = text.split('');
    //console.log(letters);
    for (var i = 0; i < letters.length; i++) {
      console.log(letters[i] + ' ' + endLineNumber + ' ' + endColumn);
      this.editorService.handleLocalInsert(
        this.editorTextModel,
        letters[i],
        endLineNumber,
        endColumn,
        this.roomName
      );

      if (letters[i] === '\n') {
        endLineNumber++;
        endColumn = 0;
      }

      endColumn++;
    }
  }

  subscribeToSignalrEvents(): void {
    this.messageService.messageReceived.subscribe((message: Message) => {
      this.ngZone.run(() => {
        const messageType = message.type;
        switch (messageType) {
          case MessageType.SiteId:
            const siteId = parseInt(message.content, 10);
            EditorService.setSiteId(siteId);
            break;
          case MessageType.RoomName:
            this.roomName = message.content;
            this.location.replaceState('/' + this.roomName);
            break;
          case MessageType.RemoteInsert:
            this.remoteOpLeft = 1;
            this.editorService.handleRemoteInsert(
              this.editorTextModel,
              message.content
            );
            break;
          case MessageType.RemoteRemove:
            this.remoteOpLeft = 1;
            this.editorService.handleRemoteRemove(
              this.editorTextModel,
              message.content
            );
            break;
          case MessageType.AllMessages:
            if (message.content !== '') {
              let crdtArr = message.content.split('~');
              this.remoteOpLeft = crdtArr.length;

              // Duplicate tab duplicate editorTextModel too
              if (this.editorTextModel === undefined) {
                this.allMessages = message.content;
              } else {
                this.editorService.handleAllMessages(
                  this.editorTextModel,
                  message.content
                );
              }
            }
            break;
          default:
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
}
