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
import { NameColor } from '../shared/NameColor';
import { Message } from '../shared/Message';

@Component({
  selector: 'app-chatbox',
  templateUrl: './chatbox.component.html',
  styleUrls: ['./chatbox.component.css'],
})
export class ChatboxComponent implements OnInit {
  messageForm: FormGroup;
  messageToSend: FormControl;
  messages: Message[] = [];
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

  getNamesColors(): NameColor[] {
    // const namesColors: NameColor[] = [];
    // const peerIds = this.peerService.getAllPeerIds();
    // console.log('All peerIds: ');
    // console.log(peerIds);
    // for (let i = 0; i < peerIds.length; i++) {
    //   const nameColor = new NameColor(this.nameService.getPeerName(peerIds[i]), this.cursorService.getPeerColor(peerIds[i]));
    //   namesColors.push(nameColor);
    // }
    // console.log(namesColors);
    // return namesColors;
    console.log(this.peerService.getNameColorList());
    return this.peerService.getNameColorList();
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
