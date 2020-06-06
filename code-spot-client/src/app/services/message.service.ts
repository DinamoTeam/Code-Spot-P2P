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
    this.stopConnection();
    this.createConnection();
    this.registerOnServerEvent();
    this.startConnection();
  }

  private createConnection() {
    /// !!! IMPORTANT: Remove configureLogging for PROD
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

  private registerOnServerEvent(): void {
    this.hubConnection.on('MessageFromServer', (data: any) => {
      this.messageReceived.emit(data);
    });
  }

  sendSignalCreateNewRoom() {
    this.hubConnection.invoke('CreateNewRoom');
  }

  sendSignalJoinExistingRoom(roomName: string) {
    this.hubConnection.invoke('JoinExistingRoom', roomName);
  }

  broadcastInsert(crdtString: string, roomName: string) {
    this.hubConnection.invoke('ExecuteInsert', crdtString, roomName);
  }

  // new
  broadcastRangeInsert(crdtStrings: string[], roomName: string): void {
    this.hubConnection.invoke('ExecuteRangeInsert', crdtStrings, roomName);
  }

  // new
  broadcastRangeRemoveNEW(crdtStrings: string[], roomName: string): void {
    this.hubConnection.invoke('ExecuteRangeRemove', crdtStrings, roomName);
  }

  broadcastRangeRemove(
    crdts: string[],
    startIndex: string,
    rangeLen: string,
    roomName: string
  ) {
    this.hubConnection.invoke(
      'ExecuteRangeRemove',
      crdts,
      startIndex,
      rangeLen,
      roomName
    );
  }

  private stopConnection() {
    if (this.connectionIsEstablished) {
      this.hubConnection.stop();
      this.hubConnection = null;
    }
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

export const enum MessageType {
  SiteId = 'SiteId',
  RoomName = 'RoomName',
  RemoteInsert = 'RemoteInsert',
  RemoteRemove = 'RemoteRemove',
  RemoteRangeInsert = 'RemoteRangeInsert',
  RemoteRangeRemove = 'RemoteRangeRemove',
  AllMessages = 'AllMessages',
}
