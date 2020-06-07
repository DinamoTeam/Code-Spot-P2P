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
Start IIS Express server through Visual Studio IDE or run this command in the project's folder
```shell
dotnet run
```
Run this command in the client's folder.

```shell
ng serve --open
```
 Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.