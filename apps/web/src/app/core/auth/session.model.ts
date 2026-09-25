export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  token: string | null;
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
}
