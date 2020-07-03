import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { retry, catchError } from "rxjs/operators";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class RoomService {
  apiURL = environment.apiUrl + "Room/";

  constructor(private http: HttpClient) { }

  // HttpClient API get() -> Create new room and return the room name
  joinNewRoom(peerId: string): Observable<string> {
    return this.http
      .get(this.apiURL + "JoinNewRoom?peerId=" + peerId, {
        responseType: "text",
      })
      .pipe(retry(1), catchError(this.handleError));
  }

  // HttpClient API get() -> Join existing room
  joinExistingRoom(peerId: string, roomName: string): Observable<any> {
    return this.http
      .get(
        this.apiURL +
        "JoinExistingRoom?peerId=" +
        peerId +
        "&roomName=" +
        roomName
      )
      .pipe(retry(1), catchError(this.handleError));
  }

  // Error handling
  handleError(error) {
    let errorMessage = "";
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = "Error from serve!";
    }
    console.log(error);
    window.alert(errorMessage);
    return throwError(errorMessage);
  }
}
