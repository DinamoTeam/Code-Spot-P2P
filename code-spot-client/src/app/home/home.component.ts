import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Utils } from '../shared/Utils';
import { BroadcastInfo } from '../shared/BroadcastInfo';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {}

  goToEditor() {
    Utils.broadcastInfo(BroadcastInfo.LeftHomePage);
    this.router.navigate(['editor']);
  }
}
