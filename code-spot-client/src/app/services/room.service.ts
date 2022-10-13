import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { EnterRoomInfo } from '../shared/EnterRoomInfo';
import { Utils } from '../shared/Utils';
import { AlertType } from '../shared/AlertType';

@Injectable({
  providedIn: 'root',
})
/**
 * This class communicate with our C# API
 */
export class RoomService {
  apiURL = environment.apiUrl + 'Room/';
  peerServerUrl = 'https://' + environment.peerServerHost;
  private HTTP_OPTIONS = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  constructor(private http: HttpClient) {}

  connectServer() {
    return this.http.get(environment.connection);
  }

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

  markPeerReceivedAllMessages(peerId: string) {
    return this.http.post<any>(this.apiURL + 'MarkPeerReceivedAllMessages', { val: peerId }, this.HTTP_OPTIONS)
      .subscribe(data => { }, error => {
        Utils.alert(
          'Something went wrong. Please join room again!',
          AlertType.Error
        );
      });
  }

  sendDummyRequestToKeepPeerServerAlive(): void {
    this.http.get(this.peerServerUrl).subscribe(() => {});
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
