import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, finalize, map, share, tap } from 'rxjs';

import { ApiService } from '../services/api.service';
import { AuthResponse, SessionState, SessionUser } from './session.model';

const TOKEN_KEY = 'travel-platform.auth-token';
const USER_KEY = 'travel-platform.auth-user';

const SIGNED_OUT: SessionState = { isAuthenticated: false, user: null, token: null };

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<SessionState>(this.readInitialState());
  /** Shared so concurrent 401s trigger one refresh call, not one per request. */
  private refreshInFlight: Observable<string> | null = null;

  readonly session = this.state.asReadonly();
  readonly isEditor = computed(() => {
    const role = this.state().user?.role;
    return role === 'EDITOR' || role === 'ADMIN';
  });

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse, { email: string; password: string }>('/auth/login', {
        email,
        password
      })
      .pipe(tap((response) => this.persist(response)));
  }

  register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse, typeof input>('/auth/register', input)
      .pipe(tap((response) => this.persist(response)));
  }

  /** Swaps the refresh cookie for a new access token. Errors mean the session is over. */
  refresh(): Observable<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.api
        .post<AuthResponse, Record<string, never>>('/auth/refresh', {})
        .pipe(
          tap((response) => this.persist(response)),
          map((response) => response.token),
          finalize(() => (this.refreshInFlight = null)),
          share()
        );
    }

    return this.refreshInFlight;
  }

  /** Revokes the refresh token on the server, then forgets the session locally. */
  logout(): Observable<void> {
    return this.api.post<unknown, Record<string, never>>('/auth/logout', {}).pipe(
      map(() => undefined),
      finalize(() => this.clear())
    );
  }

  logoutEverywhere(): Observable<void> {
    return this.api.post<unknown, Record<string, never>>('/auth/logout-all', {}).pipe(
      map(() => undefined),
      finalize(() => this.clear())
    );
  }

  /** Stores a session returned by an endpoint that issues one (e.g. password change). */
  adopt(response: AuthResponse): void {
    this.persist(response);
  }

  setUser(user: SessionUser): void {
    this.state.update((state) => ({
      ...state,
      isAuthenticated: true,
      user
    }));
    this.write(USER_KEY, JSON.stringify(user));
  }

  clear(): void {
    this.state.set(SIGNED_OUT);
    this.remove(TOKEN_KEY);
    this.remove(USER_KEY);
  }

  private persist(response: AuthResponse): void {
    this.state.set({
      isAuthenticated: true,
      user: response.user,
      token: response.token
    });
    this.write(TOKEN_KEY, response.token);
    this.write(USER_KEY, JSON.stringify(response.user));
  }

  private readInitialState(): SessionState {
    if (!this.isBrowser) {
      // Server rendering never has a session; private pages render in the browser.
      return SIGNED_OUT;
    }

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const rawUser = localStorage.getItem(USER_KEY);
      const user = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;

      return {
        isAuthenticated: Boolean(token && user),
        user,
        token
      };
    } catch {
      this.remove(TOKEN_KEY);
      this.remove(USER_KEY);
      return SIGNED_OUT;
    }
  }

  private write(key: string, value: string): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage may be unavailable (private mode); the in-memory session still works.
    }
  }

  private remove(key: string): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clean up.
    }
  }
}
