import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AboutComponent } from './about/about.component';
import { CodeEditorComponent } from './code-editor/code-editor.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'editor', redirectTo: 'editor/NONE', pathMatch: 'full' },
  { path: 'editor/:roomName', component: CodeEditorComponent},
  { path: 'About', component: AboutComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
