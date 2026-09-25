import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { Destination } from './destination.model';

@Injectable({
  providedIn: 'root'
})
export class DestinationsApiService {
  private readonly api = inject(ApiService);

  list(): Observable<Destination[]> {
    return this.api.get<Destination[]>('/destinations');
  }

  getBySlug(slug: string): Observable<Destination> {
    return this.api.get<Destination>(`/destinations/${slug}`);
  }
}
