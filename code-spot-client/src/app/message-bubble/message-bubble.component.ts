import { Component, OnInit, Input } from '@angular/core';
import { PeerService } from '../services/peer.service';

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

  constructor(private peerService: PeerService) { }

  ngOnInit() {
    this.myPeerId = this.peerService.getPeerId();
    this.displayName = this.senderName.substr(0, 8);
  }
}
