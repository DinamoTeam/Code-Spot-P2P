import { Component, OnInit, NgZone } from '@angular/core';
import { PeerService, BroadcastInfo } from '../services/peer.service';
import { FormBuilder, FormControl, FormGroup, NgForm } from '@angular/forms';

@Component({
  selector: 'app-chatbox',
  templateUrl: './chatbox.component.html',
  styleUrls: ['./chatbox.component.css']
})
export class ChatboxComponent implements OnInit {
  messageForm: FormGroup;
  messageToSend: FormControl;
  messages: any[] = [];
  myPeerId: string;

  constructor(
    private peerService: PeerService,
    private ngZone: NgZone,
    private formBuilder: FormBuilder
  ) {
    this.peerService.connectionEstablished.subscribe((successful: boolean) => {
      if (successful) 
        this.myPeerId = this.peerService.getPeerId();
    });
  }

  ngOnInit() {
    this.subscribeToPeerServerEvents();
    this.messageToSend = new FormControl("");
    this.messageForm = this.formBuilder.group({
      messageToSend: this.messageToSend,
    });
  }

  subscribeToPeerServerEvents() {
    this.peerService.infoBroadcasted.subscribe((message: any) => {
      this.ngZone.run(() => {
        switch (message) {
          case BroadcastInfo.UpdateAllMessages:
            this.messages = this.peerService.getAllMessages();
            setTimeout(() => window.scrollTo(0, 1000000), 10); // Wait 10 milli sec for message to be updated
            break;
          default:
        }
      });
    });
  }

  sendMessage(form: NgForm) {
    this.peerService.sendMessage(this.messageToSend.value);
    this.messages = this.peerService.getAllMessages();
    this.messageForm.setValue({ messageToSend: "" });
  }
}
