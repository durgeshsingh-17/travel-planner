import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

type ToastKind = 'success' | 'error' | 'info';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'success');
  }

  error(message: string): void {
    this.open(message, 'error', 4200);
  }

  info(message: string): void {
    this.open(message, 'info');
  }

  private open(message: string, kind: ToastKind, duration = 2600): void {
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['app-toast', `app-toast--${kind}`]
    });
  }
}
