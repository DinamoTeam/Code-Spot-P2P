import { EventEmitter, Injectable } from "@angular/core";
import { HubConnection, HubConnectionBuilder } from "@aspnet/signalr";

@Injectable({
  providedIn: "root",
})
export class MessageService {
  private connectionIsEstablished: boolean = false;
  connectionEstablished = new EventEmitter<Boolean>();

  private hubConnection: HubConnection;

  constructor() {}

  private createConnection() {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(window.location.href + "ServerMessageHub")
      .build();
  }

  private startConnection() {
    this.hubConnection
      .start()
      .then(() => {
        this.connectionIsEstablished = true;
        console.log("Connection with SignalR started!");
        this.connectionEstablished.emit(true);
      })
      .catch((err) => {
        console.log(
          "Error while establishing connection with SignalR, reconecting..."
        );
        setTimeout(function () {
          this.startConnection();
        }, 5000);
      });
  }

  private receiveMessageTemplate(): void {
    this.hubConnection.on("NameofJSReceiverMethod", (data: any) => {
      console.log("Received this from the server " + data);
    });
  }

  private invokeServerMethodTemplate(message: string) {
    this.hubConnection.invoke("NameofServerMethodToInvoke", message);
  }
}
