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
  namesColors: NameColor[] = [];
  showEmojiPicker: boolean = false;
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

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(event: any) {
    this.messageToSend.patchValue(
      this.messageToSend.value + event.emoji.native
    );
  }

  uploadImage(event: any) {
    const file = event.target.files[0];
    const blob = new Blob(event.target.files, { type: file.type });
    console.log(blob);

    //conn.send({
    //  file: blob,
    //  filename: file.name,
    //  filetype: file.type
    //});

  }

  subscribeToPeerServerEvents() {
    PeerUtils.broadcast.subscribe((message: BroadcastInfo) => {
      this.ngZone.run(() => {
        switch (message) {
          case BroadcastInfo.UpdateChatMessages:
            this.messages = this.peerService.getAllMessages();
            this.scrollMessageBox();
            break;
          case BroadcastInfo.NewPeerJoining:
          case BroadcastInfo.PeerLeft:
            this.namesColors = this.peerService.getNameColorList();
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
    this.scrollMessageBox();
    this.showEmojiPicker = false;
  }

  scrollMessageBox() {
    // Wait 10 milli sec for message to be updated
    setTimeout(() => this.messagebox.nativeElement.scrollTo(0, 10000000), 10);
  }
}
