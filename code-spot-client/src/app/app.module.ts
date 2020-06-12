import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { MonacoEditorModule, NgxMonacoEditorConfig } from 'ngx-monaco-editor';

import { HomeComponent } from './home/home.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { CodeEditorComponent } from './code-editor/code-editor.component';

const monacoConfig: NgxMonacoEditorConfig = {
  defaultOptions: {
    wordWrap: "on",
    showUnused: true,
    tabCompletion: "onlySnippets",
    dragAndDrop: false,
  },
  onMonacoLoad: () => {
    /* Change Config here */
  },
};

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HeaderComponent,
    FooterComponent,
    AboutComponent,
    CodeEditorComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MonacoEditorModule.forRoot(monacoConfig),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
