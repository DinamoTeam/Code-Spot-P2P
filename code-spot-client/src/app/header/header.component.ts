import { Component, OnInit, NgZone } from '@angular/core';
import { Utils } from '../shared/Utils';
import { AnnounceType } from '../shared/AnnounceType';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  isExpanded = false;
  showCreateNewRoomBtn = true;

  constructor(private ngZone: NgZone, private router: Router) {
    this.subscribeToUtilsEvents();
  }

  ngOnInit() {}

  collapse() {
    this.isExpanded = false;
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

  onBtnCreateNewRoomClick() {
    this.isExpanded = false;
    this.router.navigate(['editor']);
    this.showCreateNewRoomBtn = false;
  }

  subscribeToUtilsEvents() {
    Utils.broadcast.subscribe((message: AnnounceType) => {
      this.ngZone.run(() => {
        switch (message) {
          case AnnounceType.LeftHomePage:
            this.showCreateNewRoomBtn = false;
            break;
          default:
        }
      });
    });
  }
}
