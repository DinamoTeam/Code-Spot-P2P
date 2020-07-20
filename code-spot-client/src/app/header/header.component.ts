import { Component, OnInit, NgZone } from '@angular/core';
import { Utils } from '../shared/Utils';
import { BroadcastInfo } from '../shared/BroadcastInfo';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  isExpanded = false;
  showCreateNewRoomBtn = true;

  constructor(private ngZone: NgZone) {
    this.subscribeToUtilsEvents();
  }

  ngOnInit() {}

  collapse() {
    this.isExpanded = false;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  goHome() {
    this.isExpanded = false;
    window.location.replace('/');
    this.showCreateNewRoomBtn = true;
  }

  onBtnAboutClick() {
    this.isExpanded = false;
    window.location.replace('/About');
    this.showCreateNewRoomBtn = true;
  }

  onBtnContactClick() {
    this.isExpanded = false;
    window.location.replace('/Contact');
    this.showCreateNewRoomBtn = true;
  }

  subscribeToUtilsEvents() {
    Utils.broadcast.subscribe((message: BroadcastInfo) => {
      this.ngZone.run(() => {
        switch (message) {
          case BroadcastInfo.LeftHomePage:
            this.showCreateNewRoomBtn = false;
            break;
          default:
        }
      });
    });
  }
}
