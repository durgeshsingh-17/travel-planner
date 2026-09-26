import { Injectable, NgZone, inject } from '@angular/core';

import { ToastService } from '../../shared/services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  private readonly ngZone = inject(NgZone);
  private readonly toast = inject(ToastService);
  private wasOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  start(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);

    if (this.wasOffline) {
      this.toast.error('You are offline. Check your internet connection.');
    }
  }

  private readonly handleOffline = (): void => {
    this.ngZone.run(() => {
      this.wasOffline = true;
      this.toast.error('You are offline. Check your internet connection.');
    });
  };

  private readonly handleOnline = (): void => {
    this.ngZone.run(() => {
      if (this.wasOffline) {
        this.toast.info('Back online. You can continue.');
      }

      this.wasOffline = false;
    });
  };
}
