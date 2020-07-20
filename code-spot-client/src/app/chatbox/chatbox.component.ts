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

@Component({
  selector: 'app-chatbox',
  templateUrl: './chatbox.component.html',
  styleUrls: ['./chatbox.component.css'],
})
export class ChatboxComponent implements OnInit {
  messageForm: FormGroup;
  messageToSend: FormControl;
  messages: any[] = [];
  myPeerId: string;
  @ViewChild('messagebox', { static: false }) messagebox?: ElementRef<
    HTMLElement
  >;

  constructor(
    private peerService: PeerService,
    private ngZone: NgZone,
    private formBuilder: FormBuilder
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

  subscribeToPeerServerEvents() {
    PeerUtils.broadcast.subscribe((message: BroadcastInfo) => {
      this.ngZone.run(() => {
        switch (message) {
          case BroadcastInfo.UpdateChatMessages:
            this.messages = this.peerService.getAllMessages();
            console.log(this.messagebox);
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
