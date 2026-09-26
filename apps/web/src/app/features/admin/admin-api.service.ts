import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api.config';
import { ApiService } from '../../core/services/api.service';
import {
  AdminUser,
  AuditEntry,
  CollectionDocument,
  CollectionRow,
  ContentStatus,
  DestinationDocument,
  DestinationRow,
  Editable,
  HealthOverview,
  ImportReport,
  MediaItem,
  Page,
  PlaceDocument,
  PlaceRow,
  TagRow
} from './admin.models';

export type EditableEntity = 'destinations' | 'places' | 'collections';

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  contentHealth(): Observable<HealthOverview> {
    return this.api.get('/admin/content-health');
  }

  listDestinations(params: { q?: string; status?: ContentStatus | ''; page?: number; pageSize?: number }): Observable<Page<DestinationRow>> {
    return this.api.get(`/admin/destinations${query(params)}`);
  }

  listPlaces(params: { q?: string; status?: ContentStatus | ''; destinationId?: string; page?: number; pageSize?: number }): Observable<Page<PlaceRow>> {
    return this.api.get(`/admin/places${query(params)}`);
  }

  listCollections(params: { q?: string; status?: ContentStatus | '' } = {}): Observable<CollectionRow[]> {
    return this.api.get(`/admin/collections${query(params)}`);
  }

  get<T>(entity: EditableEntity, id: string): Observable<Editable<T>> {
    return this.api.get(`/admin/${entity}/${id}`);
  }

  create<T>(entity: EditableEntity, document: T): Observable<Editable<T>> {
    return this.api.post(`/admin/${entity}`, document);
  }

  update<T>(entity: EditableEntity, id: string, document: T, expectedUpdatedAt: string): Observable<Editable<T>> {
    return this.api.put(`/admin/${entity}/${id}`, { ...document, expectedUpdatedAt });
  }

  setStatus<T>(entity: EditableEntity, id: string, action: 'publish' | 'unpublish' | 'archive'): Observable<Editable<T>> {
    return this.api.post(`/admin/${entity}/${id}/${action}`, {});
  }

  remove(entity: EditableEntity | 'tags' | 'media', id: string): Observable<{ deleted: boolean }> {
    return this.api.delete(`/admin/${entity}/${id}`);
  }

  destinationDocument(id: string): Observable<Editable<DestinationDocument>> {
    return this.get<DestinationDocument>('destinations', id);
  }

  placeDocument(id: string): Observable<Editable<PlaceDocument>> {
    return this.get<PlaceDocument>('places', id);
  }

  collectionDocument(id: string): Observable<Editable<CollectionDocument>> {
    return this.get<CollectionDocument>('collections', id);
  }

  tags(): Observable<TagRow[]> {
    return this.api.get('/admin/tags');
  }

  saveTag(tag: Pick<TagRow, 'slug' | 'name' | 'kind' | 'description'>, id?: string): Observable<TagRow> {
    return id ? this.api.put(`/admin/tags/${id}`, tag) : this.api.post('/admin/tags', tag);
  }

  media(params: { q?: string; page?: number } = {}): Observable<Page<MediaItem>> {
    return this.api.get(`/admin/media${query(params)}`);
  }

  uploadMedia(file: File, metadata: { altText: string; license: string; credit?: string; sourceUrl?: string }): Observable<MediaItem> {
    const form = new FormData();
    Object.entries(metadata).forEach(([key, value]) => value && form.append(key, value));
    form.append('file', file);
    return this.http
      .post<{ data: MediaItem }>(`${this.baseUrl}/admin/media/upload`, form)
      .pipe(map((response) => response.data));
  }

  registerMedia(input: { url: string; altText: string; license: string; credit?: string }): Observable<MediaItem> {
    return this.api.post('/admin/media/external', input);
  }

  updateMedia(id: string, input: { altText: string; license: string; credit?: string | null }): Observable<MediaItem> {
    return this.api.patch(`/admin/media/${id}`, input);
  }

  importBundle(bundle: unknown, dryRun: boolean): Observable<ImportReport> {
    return this.api.post(`/admin/imports?dryRun=${dryRun}`, bundle);
  }

  importCsv(entity: 'locations' | 'places', csv: string, dryRun: boolean): Observable<ImportReport> {
    return this.api.post(`/admin/imports/csv?dryRun=${dryRun}`, { entity, csv });
  }

  auditLog(params: { entityType?: string; entityId?: string; page?: number } = {}): Observable<Page<AuditEntry>> {
    return this.api.get(`/admin/audit-log${query(params)}`);
  }

  users(q?: string): Observable<AdminUser[]> {
    return this.api.get(`/admin/users${query({ q })}`);
  }

  setRole(id: string, role: AdminUser['role']): Observable<AdminUser> {
    return this.api.patch(`/admin/users/${id}/role`, { role });
  }
}
