import {
  Component,
  OnInit,
  NgZone,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { PeerService } from '../services/peer.service';
import { FormBuilder, FormControl, FormGroup, NgForm } from '@angular/forms';
import { BroadcastInfo } from '../shared/BroadcastInfo';
import { PeerUtils } from '../shared/Utils';
import { CursorService } from '../services/cursor.service';
import { NameService } from '../services/name.service';
import { Message } from '@angular/compiler/src/i18n/i18n_ast';
import { NameColor } from '../shared/NameColor';

@Component({
  selector: 'app-chatbox',
  templateUrl: './chatbox.component.html',
  styleUrls: ['./chatbox.component.css'],
})
export class ChatboxComponent implements OnInit {
  messageForm: FormGroup;
  messageToSend: FormControl;
  messages: Message[] = [];
  namesColors: NameColor[] = [];
  myPeerId: string;
  @ViewChild('messagebox', { static: false }) messagebox?: ElementRef<
    HTMLElement
  >;

  constructor(
    private peerService: PeerService,
    private ngZone: NgZone,
    private formBuilder: FormBuilder,
    private cursorService: CursorService,
    private nameService: NameService
  ) {
    this.peerService.connectionEstablished.subscribe((successful: boolean) => {
      if (successful) this.myPeerId = this.peerService.getPeerId();
    });
  }

  ngOnInit() {
    this.subscribeToPeerServerEvents();
    this.messageToSend = new FormControl('');
    this.messageForm = this.formBuilder.group({
      messageToSend: this.messageToSend,
    });
  }

  getNamesColors() {
    const peerIds = this.peerService.getAllPeerIds();
    for (var i = 0; i < peerIds.length; i++) {
      let nameColor = new NameColor(this.nameService.getPeerName(peerIds[i]), this.cursorService.getPeerColor(peerIds[i]));
      this.namesColors.push(nameColor);
    }
    console.log(this.namesColors);
    return this.namesColors;
  }

  subscribeToPeerServerEvents() {
    PeerUtils.broadcast.subscribe((message: BroadcastInfo) => {
      this.ngZone.run(() => {
        switch (message) {
          case BroadcastInfo.UpdateChatMessages:
            this.messages = this.peerService.getAllMessages();
            // Wait 10 milli sec for message to be updated
            setTimeout(
              () => this.messagebox.nativeElement.scrollTo(0, 10000000),
              10
            );
            this.namesColors = this.getNamesColors();
            break;
          default:
        }
      });
    });
  }

  sendMessage(form: NgForm) {
    this.peerService.sendMessage(this.messageToSend.value);
    this.messages = this.peerService.getAllMessages();
    this.messageForm.setValue({ messageToSend: '' });
    // Wait 10 milli sec for message to be updated
    setTimeout(() => this.messagebox.nativeElement.scrollTo(0, 10000000), 10);
  }
}
