export type UserRole = 'TRAVELLER' | 'AGENT' | 'EDITOR' | 'ADMIN';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
}

export interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  token: string | null;
}

/** The refresh token never reaches JavaScript: it lives in an httpOnly cookie. */
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: SessionUser;
}
