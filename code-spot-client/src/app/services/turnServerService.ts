import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable  } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
/**
 * This class communicate with our C# API
 */
export class TurnServerService {
  private apiURL = environment.apiUrl + 'turnServerToken/';

  constructor(private http: HttpClient) {}

  getTurnStunToken(): Observable<any> {
      return this.http.get<any>(this.apiURL)
  }
}
