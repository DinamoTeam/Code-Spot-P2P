import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { retry, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {
  private apiURL = environment.apiUrl + 'Utilities/';
  private HTTP_OPTIONS = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  }

  constructor(private http: HttpClient) { }

  sendEmail(email) {
    console.log(email);
    const ans = this.http.post<string>(this.apiURL + 'SendEmail', JSON.stringify(email), this.HTTP_OPTIONS).pipe(
      retry(1),
      catchError(this.handleError))
    console.log(ans);
    return ans;
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
