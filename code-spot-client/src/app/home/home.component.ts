import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit{
  constructor() { }

  selectedLang;
  languageForm = new FormGroup({
    language: new FormControl(
      "cpp",
      Validators.compose([Validators.required])
    )
  });

  ngOnInit() {
    this.selectedLang = "cpp";
 }

  @Input() languages = [
    { name: "C++", value: "cpp" },
    { name: "C#", value: "csharp" },
    { name: "Java", value: "java" },
    { name: "Python", value: "python" },
    { name: "JavaScript", value: "javascript" }
  ]

  editorCplusplus = { theme: "vs-dark", language: "cpp" };
  editorCsharp = { theme: "vs-dark", language: "csharp" };
  editorJava = { theme: "vs-dark", language: "java" };
  editorJS = { theme: "vs-dark", language: "javascript" };
  editorPython = { theme: "vs-dark", language: "python" };

  editorOptions = { theme: 'vs-dark', language: 'javascript' };
  code: string = 'function x() {\nconsole.log("Hello world!");\n}';

  onLanguageChange(res) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);;
    console.log(this.selectedLang);
  }
}
