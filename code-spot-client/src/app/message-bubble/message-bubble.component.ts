import { Component, OnInit, Input } from '@angular/core';
import { PeerService } from '../services/peer.service';
import { NameService } from '../services/name.service';

@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.css']
})
export class MessageBubbleComponent implements OnInit {
  @Input() senderName: string;
  @Input() content: string;

  myPeerId: string;
  displayName: string;

  constructor(private peerService: PeerService, public nameService: NameService) { }

  ngOnInit() {
    this.myPeerId = this.peerService.getMyPeerId();
    this.displayName = this.nameService.getPeerName(this.senderName);
  }
}
