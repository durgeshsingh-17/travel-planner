import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { API_BASE_URL } from '../config/api.config';
import { SessionService } from '../auth/session.service';
import { apiErrorInterceptor } from './api-error.interceptor';

const user = { id: 'user-1', name: 'Asha', email: 'asha@example.com', role: 'TRAVELLER' as const };

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.adopt({ token: 'old-token', expiresAt: '2026-01-01T00:00:00Z', user });
  });

  afterEach(() => backend.verify());

  it('attaches the access token and credentials to API calls only', () => {
    http.get(`${API_BASE_URL}/trips`).subscribe();
    http.get('https://api.open-meteo.com/v1/forecast').subscribe();

    const api = backend.expectOne(`${API_BASE_URL}/trips`);
    expect(api.request.headers.get('Authorization')).toBe('Bearer old-token');
    expect(api.request.withCredentials).toBe(true);
    api.flush({ success: true, data: [] });

    const external = backend.expectOne('https://api.open-meteo.com/v1/forecast');
    expect(external.request.headers.has('Authorization')).toBe(false);
    expect(external.request.withCredentials).toBe(false);
    external.flush({});
  });

  it('refreshes once on 401 and retries concurrent requests with the new token', () => {
    const results: unknown[] = [];
    http.get(`${API_BASE_URL}/trips`).subscribe((value) => results.push(value));
    http.get(`${API_BASE_URL}/me`).subscribe((value) => results.push(value));

    backend.expectOne(`${API_BASE_URL}/trips`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API_BASE_URL}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${API_BASE_URL}/auth/refresh`);
    refresh.flush({
      success: true,
      data: { token: 'new-token', expiresAt: '2026-01-01T00:15:00Z', user }
    });

    const retries = backend.match((request) => request.headers.get('Authorization') === 'Bearer new-token');
    expect(retries.map((request) => request.request.url).sort()).toEqual(
      [`${API_BASE_URL}/me`, `${API_BASE_URL}/trips`].sort()
    );
    retries.forEach((request) => request.flush({ ok: true }));

    expect(results).toHaveLength(2);
    expect(session.session().token).toBe('new-token');
  });

  it('signs out and redirects when the refresh fails', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let error: Error | undefined;
    http.get(`${API_BASE_URL}/trips`).subscribe({ error: (value) => (error = value) });

    backend.expectOne(`${API_BASE_URL}/trips`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(`${API_BASE_URL}/auth/refresh`)
      .flush({ success: false }, { status: 401, statusText: 'Unauthorized' });

    expect(error?.message).toMatch(/session has expired/i);
    expect(session.session().isAuthenticated).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], expect.objectContaining({
      queryParams: expect.objectContaining({ reason: 'session-expired' })
    }));
  });

  it('does not try to refresh after a failed sign-in', () => {
    let error: Error | undefined;
    http.post(`${API_BASE_URL}/auth/login`, {}).subscribe({ error: (value) => (error = value) });

    backend.expectOne(`${API_BASE_URL}/auth/login`).flush(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
      { status: 401, statusText: 'Unauthorized' }
    );

    backend.expectNone(`${API_BASE_URL}/auth/refresh`);
    expect(error?.message).toBe('Invalid email or password');
    expect(session.session().isAuthenticated).toBe(true);
  });
});
