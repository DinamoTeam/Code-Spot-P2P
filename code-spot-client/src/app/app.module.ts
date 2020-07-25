import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { MonacoEditorModule, NgxMonacoEditorConfig } from 'ngx-monaco-editor';
import { PickerModule } from '@ctrl/ngx-emoji-mart';

import { HomeComponent } from './home/home.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { CodeEditorComponent } from './code-editor/code-editor.component';
import { ChatboxComponent } from './chatbox/chatbox.component';
import { HttpClientModule } from '@angular/common/http';
import { ContactComponent } from './contact/contact.component';
import { MessageBubbleComponent } from './message-bubble/message-bubble.component';

const monacoConfig: NgxMonacoEditorConfig = {
  defaultOptions: {
    wordWrap: 'on',
    showUnused: true,
    tabCompletion: 'onlySnippets',

    // Trying to disable deleting white spaces
    autoClosingOvertype: 'never',
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    autoIndent: 'none',
    autoSurround: 'never',
    folding: false,
    renderIndentGuides: false,
    wrappingIndent: 'none',
    disableMonospaceOptimizations: true,
  },
  onMonacoLoad,
};

export function onMonacoLoad() {
  /* Change Config here */
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HeaderComponent,
    FooterComponent,
    AboutComponent,
    CodeEditorComponent,
    ChatboxComponent,
    ContactComponent,
    MessageBubbleComponent,
  ],
  imports: [
    HttpClientModule,
    BrowserModule,
    AppRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MonacoEditorModule.forRoot(monacoConfig),
    PickerModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
