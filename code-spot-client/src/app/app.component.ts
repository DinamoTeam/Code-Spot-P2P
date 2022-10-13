import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { RoomService } from './services/room.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  title = 'code-spot-client';

  constructor(private roomService: RoomService) { }

  ngOnInit(): void {
    this.roomService.connectServer().subscribe((data: any) => { });
  }
}
