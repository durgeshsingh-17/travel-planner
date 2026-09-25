import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { ApiSuccessResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiSuccessResponse<T>>(this.buildUrl(path))
      .pipe(map((response) => response.data));
  }

  post<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .post<ApiSuccessResponse<T>>(this.buildUrl(path), body)
      .pipe(map((response) => response.data));
  }

  patch<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .patch<ApiSuccessResponse<T>>(this.buildUrl(path), body)
      .pipe(map((response) => response.data));
  }

  put<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .put<ApiSuccessResponse<T>>(this.buildUrl(path), body)
      .pipe(map((response) => response.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiSuccessResponse<T>>(this.buildUrl(path))
      .pipe(map((response) => response.data));
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
  }
}
