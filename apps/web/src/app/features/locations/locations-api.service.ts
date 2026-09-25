import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { Location } from './location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationsApiService {
  private readonly api = inject(ApiService);

  list(params: { q?: string; state?: string; limit?: number } = {}): Observable<Location[]> {
    const search = new URLSearchParams();

    if (params.q?.trim()) {
      search.set('q', params.q.trim());
    }

    if (params.state?.trim()) {
      search.set('state', params.state.trim());
    }

    if (params.limit) {
      search.set('limit', String(params.limit));
    }

    const queryString = search.toString();
    return this.api.get<Location[]>(
      queryString ? `/locations?${queryString}` : '/locations'
    );
  }
}
