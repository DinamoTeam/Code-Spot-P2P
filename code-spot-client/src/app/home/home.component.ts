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

  editorOptions = { theme: 'vs-dark', language: 'cpp' };
  code: string = 'function x() {\nconsole.log("Hello world!");\n}';

  onLanguageChange(res) {
    this.selectedLang = res.slice(res.indexOf(':') + 2);;
    console.log(this.selectedLang);

    if (this.selectedLang == 'cpp') {
      this.editorOptions = Object.assign({}, this.editorOptions, { language: "cpp" });
    } else if (this.selectedLang == 'javascript') {
      this.editorOptions = Object.assign({}, this.editorOptions, { language: "javascript" });
    } else if (this.selectedLang == 'csharp') {
      this.editorOptions = Object.assign({}, this.editorOptions, { language: "csharp" });
    } else if (this.selectedLang == 'java') {
      this.editorOptions = Object.assign({}, this.editorOptions, { language: "java" });
    } else if (this.selectedLang == 'python') {
      this.editorOptions = Object.assign({}, this.editorOptions, { language: "python" });
    } 
  }
}
