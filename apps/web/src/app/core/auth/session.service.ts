import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiService } from '../services/api.service';
import { AuthResponse, SessionState, SessionUser } from './session.model';

const TOKEN_KEY = 'travel-platform.auth-token';
const USER_KEY = 'travel-platform.auth-user';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly state = signal<SessionState>(this.readInitialState());

  readonly session = this.state.asReadonly();

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

  setUser(user: SessionUser): void {
    this.state.update((state) => ({
      ...state,
      isAuthenticated: true,
      user
    }));
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clear(): void {
    this.state.set({
      isAuthenticated: false,
      user: null,
      token: null
    });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private persist(response: AuthResponse): void {
    this.state.set({
      isAuthenticated: true,
      user: response.user,
      token: response.token
    });
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }

  private readInitialState(): SessionState {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    try {
      const user = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;

      return {
        isAuthenticated: Boolean(token && user),
        user,
        token
      };
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      return {
        isAuthenticated: false,
        user: null,
        token: null
      };
    }
  }
}
