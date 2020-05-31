import { Component, OnInit, Input, NgZone } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { EditorService } from '../services/editor.service';
import { MessageService, MessageType } from '../services/message.service';
import { Message } from '../shared/Message';
import { ActivatedRoute } from '@angular/router';

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
  selectedLang: string;
  languageForm = new FormGroup({
    language: new FormControl('cpp', Validators.compose([Validators.required])),
  });

  constructor(
    public editorService: EditorService,
    private messageService: MessageService,
    private ngZone: NgZone,
    private actRoute: ActivatedRoute
  ) {
    this.subscribeToSignalrEvents();
    this.getRoomName();
  }

  ngOnInit() {
    this.selectedLang = 'cpp';
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
    console.log(this.selectedLang);

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

    this.editorService.executeInsert(
      this.editorTextModel,
      'Hello World!',
      1,
      1,
      1,
      1
    );
  }

  onDidPasteHandler(event: any) {
    const rangeDetails = event;
    console.log('Pasted range' + rangeDetails);
    console.log(rangeDetails);
  }

  onDidChangeModelContentHandler(event: any): void {
    const change = event.changes[0];

    // The range that got replaced
    const rangeDetails = change.range;
    console.log('Range Details: ' + rangeDetails);
    console.log(rangeDetails);

    // Length of the range that got replaced
    const rangeLen = change.rangeLength;
    console.log('Range Length: ' + rangeLen);

    // The new text for the range (! \n can't see)
    const newText = change.text;
    console.log('New text: |' + newText + '|');

    // It's a remove event
    if (newText == '') {
      this.editorService.handleLocalRemove(this.editorTextModel, rangeDetails.startLineNumber, rangeDetails.startColumn, this.roomName);
    }

    // It's insert event
    this.editorService.handleLocalInsert(this.editorTextModel, newText, rangeDetails.endLineNumber, rangeDetails.endColumn, this.roomName);
  }

  subscribeToSignalrEvents(): void {
    this.messageService.messageReceived.subscribe((message: Message) => {
      this.ngZone.run(() => {
        console.log('MESSAGE FROM SERVER !!!');
        console.log(message);

        const messageType = message.type;
        switch (messageType) {
          case MessageType.SiteId:
            const siteId = parseInt(message.content, 10);
            EditorService.setSiteId(siteId);
            break;
          case MessageType.RoomName:
            this.roomName = message.content;
            break;
          case MessageType.RemoteInsert:
            this.editorService.handleRemoteInsert(this.editorTextModel, message.content);
            break;
          case MessageType.RemoteRemove:
            this.editorService.handleRemoteRemove(this.editorTextModel, message.content);
            break;
          case MessageType.AllMessages:
            console.log("AllMessage coming ...!")
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
