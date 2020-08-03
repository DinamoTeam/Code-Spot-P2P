import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { UtilsService } from '../services/utils.service';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.css'],
})
export class FeedbackComponent implements OnInit {
  feedbackForm: FormGroup;

  didWellMap = { 0: 'Look and feel', 1: 'Functionality', 2: 'Convenience' };

  issuesMap = {
    0: 'Nothing',
    1: 'The app was confusing to use',
    2: 'The app was missing features I needed',
    3: 'I experienced bugs',
    4: 'The app suddenly crashed',
    5: 'Other',
  };

  constructor(
    private formBuilder: FormBuilder,
    private utilService: UtilsService
  ) {
    this.feedbackForm = this.formBuilder.group({
      satisfactionLevel: '100%',
      collabLevel: '100%',
      didWell: '0',
      issue: 0,
      issueDetails: '',
      improvement: '',
    });
  }

  ngOnInit() {}

  onSubmit(form) {
    this.feedbackForm.value['didWell'] = this.didWellMap[
      this.feedbackForm.value['didWell']
    ];
    this.feedbackForm.value['issue'] = this.issuesMap[
      this.feedbackForm.value['issue']
    ];

    this.utilService.sendFeedbackForm(form);
  }
}
