import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';

@Injectable({
  providedIn: 'root',
})
/**
 * This class communicate with our C# API
 */
export class RoomService {
  apiURL = environment.apiUrl + 'Room/';

  constructor(private http: HttpClient) {}

  joinNewRoom(peerId: string): Observable<EnterRoomInfo> {
    return this.http
      .get<EnterRoomInfo>(this.apiURL + 'JoinNewRoom?peerId=' + peerId)
      .pipe(retry(1), catchError(this.handleError));
  }

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
