# Code-Spot

## A sync code editor

![](./images/Welcome.png)

## **Development setup**

Download SQLite3
https://sqlite.org/download.html

Install the EF Core SQL Server provider

```shell
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
```
Create/Update the local instance of the DB

```shell
dotnet ef database drop
dotnet ef database update
```
This project was generated with [Angular CLI](https://cli.angular.io/) version 8.3.9.

Install the CLI using NPM ([Node.js](https://nodejs.org/en/) >= 10 required)

```shell
npm install -g @angular/cli@8.3.9 
```
In the client's folder. Restore all NPM packages by running

```shell
npm install
```
This project uses peer to peer (PeerJS). Config PeerServer
Replace the content in file Code-Spot-P2P\code-spot-client\node_modules\peer\node_modules\ws\index.js with the following

```js
'use strict';

const WebSocket = require('./lib/websocket');

WebSocket.createWebSocketStream = require('./lib/stream');
WebSocket.Server = require('./lib/websocket-server');
WebSocket.Receiver = require('./lib/receiver');
WebSocket.Sender = require('./lib/sender');

module.exports = WebSocket;


const PeerServer = require('peer').PeerServer;
const server = PeerServer({
    port: 9000, 
    path: '/myapp'});

const baseUrl = 'https://localhost:44395/api/Room/';
const https = require('https');

server.on('connection', (client) => {/* Do nothing */});
server.on('disconnect', (client) => handleDisconnect(client));

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0; 

function handleDisconnect(client) {
    // Delete peer from Db
    const url = baseUrl + "DeletePeer?peerId=" + client.getId();
    https.get(url, response => {
        let data = '';
        response.on('data', chunk => {
            data += chunk;
        })
        response.on('end', () => {
            console.log(data);
            console.log('Deleted peer with id: ' + client.getId() + ' from database');
        })
    })
    .on('error', err => {
        console.log('Error: ' + err.message);
    });
}
```

Start PeerServer

```shell
node code-spot-client/node_modules/peer/node_modules/ws/index.js
### Go to this link to make sure PeerServer run successfully http://127.0.0.1:9000/myapp
```

Start IIS Express server through Visual Studio IDE or run this command in the project's folder
```shell
dotnet run
```
Run this command in the client's folder.

```shell
ng serve --open
```
 Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.