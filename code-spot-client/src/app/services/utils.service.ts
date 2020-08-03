import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { retry, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  private apiURL = environment.apiUrl + 'Utilities/';
  private HTTP_OPTIONS = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  constructor(private http: HttpClient) {}

  sendEmail(email) {
    return this.http
      .post<any>(this.apiURL + 'SendEmail', email, this.HTTP_OPTIONS)
      .subscribe((data) => {
        console.log(data);
      });
  }

  sendFeedbackForm(form) {
    return this.http
      .post<any>(this.apiURL + 'SendFeedbackForm', form, this.HTTP_OPTIONS)
      .subscribe((data) => {
        console.log(data);
      });
  }
}
