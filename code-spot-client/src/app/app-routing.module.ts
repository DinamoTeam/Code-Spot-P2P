import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AboutComponent } from './about/about.component';
import { CodeEditorComponent } from './code-editor/code-editor.component';
import { ContactComponent } from './contact/contact.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'editor', redirectTo: 'editor/NONE', pathMatch: 'full' },
  { path: 'editor/:roomName', component: CodeEditorComponent},
  { path: 'About', component: AboutComponent },
  { path: 'Contact', component: ContactComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
