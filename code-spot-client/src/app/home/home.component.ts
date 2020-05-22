import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

declare const monaco: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit{
  constructor() { }


  editor: any;
  selectedLang: string;
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

  onChange(e) {
    console.log(e);
  }

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

  onInitHandler(event: any){
    this.editor = event;
    // this.editor.onDidBlurEditorText((e: any) => this.onBlurEditorTextHandler(e));
    
      console.log(this.editor);
      let line = this.editor.getPosition();
      let range = new monaco.Range(line.lineNumber, 1, line.lineNumber, 1);
      let id = { major: 1, minor: 1 };
      let text = 'FOO';
      let op = { identifier: id, range: range, text: text, forceMoveMarkers: true };
      this.editor.executeEdits("my-source", [op]);
  }

  onChangeHandler(event: any){
    console.log(event);
  }
}
