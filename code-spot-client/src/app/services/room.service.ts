import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  apiURL = environment.apiUrl + 'Room/';

  constructor(private http: HttpClient) {}

  // HttpClient API get() -> Create new room and return the room name
  joinNewRoom(peerId: string): Observable<EnterRoomInfo> {
    return this.http
      .get<EnterRoomInfo>(this.apiURL + 'JoinNewRoom?peerId=' + peerId)
      .pipe(retry(1), catchError(this.handleError));
  }

  // HttpClient API get() -> Join existing room
  joinExistingRoom(
    peerId: string,
    roomName: string
  ): Observable<EnterRoomInfo> {
    return this.http
      .get<EnterRoomInfo>(
        this.apiURL +
          'JoinExistingRoom?peerId=' +
          peerId +
          '&roomName=' +
          roomName
      )
      .pipe(retry(1), catchError(this.handleError));
  }

  // HttpClient API get() -> get PeerIds In Room
  getPeerIdsInRoom(roomName: string): Observable<string[]> {
    return this.http
      .get<string[]>(this.apiURL + 'GetPeerIdsInRoom?roomName=' + roomName)
      .pipe(retry(1), catchError(this.handleError));
  }

  markPeerReceivedAllMessages(peerId: string): void {
    const myheader = new HttpHeaders().set(
      'Content-Type',
      'application/x-www-form-urlencoded'
    );
    let body = new HttpParams();
    body = body.set('peerId', peerId);
    this.http
      .post(this.apiURL + 'MarkPeerReceivedAllMessages', body, {
        headers: myheader,
      })
      .pipe(retry(1), catchError(this.handleError))
      .subscribe(() => {});
  }

  // Error handling
  private handleError(error) {
    let errorMessage = '';
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = 'Error from serve!';
    }
    window.alert(errorMessage);
    return throwError(error);
  }
}
