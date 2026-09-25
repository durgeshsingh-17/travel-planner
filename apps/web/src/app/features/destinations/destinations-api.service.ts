import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { Destination } from './destination.model';

@Injectable({
  providedIn: 'root'
})
export class DestinationsApiService {
  private readonly api = inject(ApiService);

  list(params: { q?: string; state?: string; limit?: number } = {}): Observable<Destination[]> {
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
    return this.api.get<Destination[]>(
      queryString ? `/destinations?${queryString}` : '/destinations'
    );
  }

  getBySlug(slug: string): Observable<Destination> {
    return this.api.get<Destination>(`/destinations/${slug}`);
  }
}
