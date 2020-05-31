import { EventEmitter, Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@aspnet/signalr';
import { Message } from '../shared/Message';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messageReceived = new EventEmitter<Message>();
  private connectionIsEstablished: boolean = false;
  connectionEstablished = new EventEmitter<Boolean>();

  private hubConnection: HubConnection;

  constructor() {
    this.createConnection();
    this.registerOnSiteIdEvent();
    this.startConnection();
  }

  private createConnection() {
    this.hubConnection = new HubConnectionBuilder()
      .configureLogging(LogLevel.Information)
      .withUrl('https://localhost:44394/ServerMessageHub')
      .build();
  }

  private startConnection(): void {
    this.hubConnection
      .start()
      .then(() => {
        this.connectionIsEstablished = true;
        console.log('Connection with SignalR started!');
        this.connectionEstablished.emit(true);
      })
      .catch((err) => {
        console.log(
          'Error while establishing connection with SignalR, reconecting...'
        );
        setTimeout(function () {
          this.startConnection();
        }, 5000);
      });
  }

  private registerOnSiteIdEvent(): void {
    this.hubConnection.on('SiteId', (data: any) => {
      this.messageReceived.emit(data);
    });
  }

  /******************** SignalR Template ***************************
  private receiveMessageTemplate(): void {
    this.hubConnection.on("NameofJSReceiverMethod", (data: any) => {
      console.log("Received this from the server " + data);
    });
  }

  private invokeServerMethodTemplate(message: string) {
    this.hubConnection.invoke("NameofServerMethodToInvoke", message);
  }
  */
}
