import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { HealthStatus } from '../models/health.model';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private readonly api = inject(ApiService);

  check(): Observable<HealthStatus> {
    return this.api.get<HealthStatus>('/health');
  }
}
