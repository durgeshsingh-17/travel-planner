import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, startWith, switchMap } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AdminApiService } from './admin-api.service';
import { AdminUser } from './admin.models';
import { SessionService } from '../../core/auth/session.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <main class="admin-page">
      <h1>Users</h1>
      <p class="muted">Editors manage content. Admins can also import, delete content and change roles.</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search by name or email</mat-label>
        <input matInput [formControl]="search" />
      </mat-form-field>
      <table class="admin-table">
        <tr><th>Name</th><th>Email</th><th>Trips</th><th>Role</th></tr>
        @for (user of users(); track user.id) {
          <tr>
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.tripCount }}</td>
            <td>
              <select [value]="user.role" [disabled]="user.id === myId" (change)="setRole(user, $any($event.target).value)" [attr.aria-label]="'Role for ' + user.email">
                <option value="TRAVELLER">Traveller</option>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </td>
          </tr>
        }
      </table>
    </main>
  `,
  styles: `select { padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent {
  private readonly admin = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  protected readonly myId = inject(SessionService).session().user?.id;
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly users = signal<AdminUser[]>([]);

  constructor() {
    this.search.valueChanges
      .pipe(startWith(''), debounceTime(250), switchMap((q) => this.admin.users(q)), takeUntilDestroyed())
      .subscribe((users) => this.users.set(users));
  }

  protected setRole(user: AdminUser, role: AdminUser['role']): void {
    if (!confirm(`Change ${user.email} to ${role}?`)) {
      this.users.update((users) => [...users]);
      return;
    }

    this.admin.setRole(user.id, role).subscribe({
      next: (updated) => {
        this.users.update((users) => users.map((entry) => (entry.id === updated.id ? { ...entry, role: updated.role } : entry)));
        this.toast.success('Role updated');
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }
}
