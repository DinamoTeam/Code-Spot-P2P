import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  isExpanded = false;

  constructor() {}

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
  }

  onBtnAboutClick() {
    this.isExpanded = false;
    window.location.replace('/About');
  }

  onBtnContactClick() {
    this.isExpanded = false;
    window.location.replace('/Contact');
  }
}
