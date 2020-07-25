import {
  Component,
  OnInit,
  NgZone,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { PeerService } from '../services/peer.service';
import { FormBuilder, FormControl, FormGroup, NgForm } from '@angular/forms';
import { AnnounceType } from '../shared/AnnounceType';
import { PeerUtils, Utils } from '../shared/Utils';
import { NameColor } from '../shared/NameColor';
import { Message } from '../shared/Message';
import { AlertType } from '../shared/AlertType';

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
  myUsername: string = '';
  @ViewChild('messagebox', { static: false }) messagebox?: ElementRef<
    HTMLElement
  >;

  constructor(
    private peerService: PeerService,
    private ngZone: NgZone,
    private formBuilder: FormBuilder
  ) {  }

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

  editName() {
    const newName = this.myUsername;
    this.peerService.changeMyName(newName);
    this.namesColors = this.peerService.getNameColorList();
    this.peerService.broadcastChangeName(newName);
    Utils.alert('Your name has been changed to ' + newName, AlertType.Success);
  }

  subscribeToPeerServerEvents() {
    PeerUtils.announce.subscribe((message: AnnounceType) => {
      this.ngZone.run(() => {
        switch (message) {
          case AnnounceType.UpdateChatMessages:
            this.messages = this.peerService.getAllMessages();
            this.scrollMessageBox();
            break;
          case AnnounceType.NewPeerJoining:
            this.myUsername = this.peerService.getMyName();
          case AnnounceType.ChangePeerName:
          case AnnounceType.PeerLeft:
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
