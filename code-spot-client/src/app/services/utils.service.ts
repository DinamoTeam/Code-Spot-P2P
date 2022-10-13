import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { retry, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Utils } from '../shared/Utils';
import { AlertType } from '../shared/AlertType';

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

  constructor(private http: HttpClient) { }

  sendEmail(email) {
    console.log(email);
    return this.http
      .post<any>(this.apiURL + 'SendEmail', email, this.HTTP_OPTIONS)
      .subscribe(
        (data) => {
          Utils.alert('Submit successfully', AlertType.Success);
        },
        (error) => {
          Utils.alert(
            'Something went wrong. Please try again',
            AlertType.Error
          );
        }
      );
  }

  sendFeedbackForm(form) {
    return this.http
      .post<any>(this.apiURL + 'SendFeedbackForm', form, this.HTTP_OPTIONS)
      .subscribe(
        (data) => {
          Utils.alert('Submit successfully', AlertType.Success);
        },
        (error) => {
          Utils.alert(
            'Something went wrong. Please try again',
            AlertType.Error
          );
        }
      );
  }
}
