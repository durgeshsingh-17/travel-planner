import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Faq } from '../admin.models';

export function faqGroup(fb: FormBuilder, faq: Partial<Faq> = {}): FormGroup {
  return fb.nonNullable.group({
    question: [faq.question ?? '', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    answer: [faq.answer ?? '', [Validators.required, Validators.minLength(5), Validators.maxLength(2000)]]
  });
}

@Component({
  selector: 'app-faq-fields',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <div class="row-list">
      @for (group of faqs().controls; track group; let index = $index) {
        <div class="row" [formGroup]="asGroup(group)">
          <mat-form-field appearance="outline">
            <mat-label>Question</mat-label>
            <input matInput formControlName="question" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Answer</mat-label>
            <textarea matInput formControlName="answer" rows="2"></textarea>
          </mat-form-field>
          <button mat-button type="button" (click)="remove(index)">Remove</button>
        </div>
      }
      <button mat-stroked-button type="button" (click)="add()">Add FAQ</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqFieldsComponent {
  private readonly fb = inject(FormBuilder);
  readonly faqs = input.required<FormArray>();

  protected asGroup(control: unknown): FormGroup {
    return control as FormGroup;
  }

  protected add(): void {
    this.faqs().push(faqGroup(this.fb));
  }

  protected remove(index: number): void {
    this.faqs().removeAt(index);
    this.faqs().markAsDirty();
  }
}
