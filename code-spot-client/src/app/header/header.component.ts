import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  isExpanded = false;

  constructor(private router: Router) { }

  ngOnInit() {
  }

  collapse() {
    this.isExpanded = false;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  goHome() {
    this.isExpanded = false;
    window.location.replace("/");
  }

  onBtnAboutClick() {
    this.isExpanded = false;
    this.router.navigate(['About']);
  }

  onBtnContactClick() {
    this.isExpanded = false;
    this.router.navigate(['Contact']);
  }
}
