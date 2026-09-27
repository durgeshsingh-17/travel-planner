import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AdminApiService } from './admin-api.service';
import { AgentRow } from './admin.models';
import { INDIA_PHONE_PATTERN } from '../../shared/utils/identity-validation.util';
import { ToastService } from '../../shared/services/toast.service';
import { slugify } from './shared/content-editor.base';

@Component({
  selector: 'app-admin-agents',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <main class="admin-page">
      <h1>Agencies</h1>
      <p class="muted">Quote requests go to up to three active agencies that serve the trip's state. Link an agency to a user account so it can answer in the app; otherwise enter its quotes from Quote requests.</p>

      <form class="admin-card form-grid" [formGroup]="form" (ngSubmit)="save()">
        <h2 class="wide">{{ editingId() ? 'Edit agency' : 'Add an agency' }}</h2>
        <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput formControlName="displayName" (input)="suggestSlug()" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Slug</mat-label><input matInput formControlName="slug" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput type="email" formControlName="email" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Mobile</mat-label><input matInput formControlName="phone" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>City</mat-label><input matInput formControlName="city" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Max open requests</mat-label><input matInput type="number" formControlName="maxOpenLeads" /></mat-form-field>
        <mat-form-field appearance="outline" class="wide">
          <mat-label>States served (comma separated)</mat-label>
          <input matInput formControlName="serviceStates" placeholder="Uttarakhand, Himachal Pradesh" />
          <mat-hint>Leave empty if the agency covers all of India</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Linked user email (optional)</mat-label><input matInput formControlName="userEmail" /><mat-hint>They must have signed up first</mat-hint></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Internal notes</mat-label><input matInput formControlName="notes" /></mat-form-field>
        <mat-checkbox formControlName="isActive">Active (receives new requests)</mat-checkbox>
        <div class="wide">
          <button mat-flat-button color="primary" type="submit">{{ editingId() ? 'Save agency' : 'Add agency' }}</button>
          @if (editingId()) { <button mat-button type="button" (click)="reset()">Cancel</button> }
        </div>
      </form>

      <table class="admin-table">
        <tr><th>Agency</th><th>Serves</th><th>Login</th><th>Requests</th><th>Quotes / accepted</th><th></th></tr>
        @for (agent of agents(); track agent.id) {
          <tr>
            <td><strong>{{ agent.displayName }}</strong>@if (!agent.isActive) { <span class="muted"> (inactive)</span> }<div class="muted small">{{ agent.email }} · {{ agent.phone }}</div></td>
            <td>{{ agent.serviceStates.length ? agent.serviceStates.join(', ') : 'All of India' }}</td>
            <td>{{ agent.userEmail ?? '—' }}</td>
            <td>{{ agent.requestsReceived }}</td>
            <td>{{ agent.quotesSent }} / {{ agent.quotesAccepted }}</td>
            <td><button mat-button type="button" (click)="edit(agent)">Edit</button></td>
          </tr>
        } @empty {
          <tr><td colspan="6" class="muted">No agencies yet. Requests stay unrouted until you add one.</td></tr>
        }
      </table>
    </main>
  `,
  styles: `.small { font-size: .8rem; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAgentsComponent {
  private readonly admin = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  protected readonly agents = signal<AgentRow[]>([]);
  protected readonly editingId = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(INDIA_PHONE_PATTERN)]],
    city: [''],
    maxOpenLeads: [20, [Validators.min(1)]],
    serviceStates: [''],
    userEmail: [''],
    notes: [''],
    isActive: [true]
  });

  constructor() {
    this.load();
  }

  protected suggestSlug(): void {
    if (!this.editingId() && !this.form.controls.slug.dirty) {
      this.form.controls.slug.setValue(slugify(this.form.controls.displayName.value));
    }
  }

  protected edit(agent: AgentRow): void {
    this.editingId.set(agent.id);
    this.form.reset({
      displayName: agent.displayName,
      slug: agent.slug,
      email: agent.email,
      phone: agent.phone.replace(/^\+91/, ''),
      city: agent.city ?? '',
      maxOpenLeads: agent.maxOpenLeads,
      serviceStates: agent.serviceStates.join(', '),
      userEmail: agent.userEmail ?? '',
      notes: agent.notes ?? '',
      isActive: agent.isActive
    });
  }

  protected reset(): void {
    this.editingId.set(null);
    this.form.reset();
  }

  protected save(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.toast.error('Check the highlighted fields.');
      return;
    }

    const value = this.form.getRawValue();
    this.admin
      .saveAgent(
        {
          ...value,
          city: value.city || null,
          notes: value.notes || null,
          maxOpenLeads: Number(value.maxOpenLeads),
          serviceStates: value.serviceStates.split(',').map((state) => state.trim()).filter(Boolean),
          userEmail: value.userEmail ? value.userEmail : this.editingId() ? null : undefined
        },
        this.editingId() ?? undefined
      )
      .subscribe({
        next: () => {
          this.toast.success('Agency saved');
          this.reset();
          this.load();
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  private load(): void {
    this.admin.agents().subscribe((agents) => this.agents.set(agents));
  }
}
