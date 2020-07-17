import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
})
export class ContactComponent implements OnInit {
  contactForm: FormGroup;

  constructor(private formBuilder: FormBuilder) {
    this.contactForm = this.formBuilder.group({
      name: '',
      email: '',
      subject: '',
      message: '',
    });
  }

  ngOnInit() {}

  onSubmit(form) {
    console.log(form);
    this.contactForm.reset();

    if (form['message'] != '') {
      console.log(JSON.stringify(form));
      // TODO: send to backend to send email
    }
  }
}
