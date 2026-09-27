import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { AuthResponse, SessionUser } from '../../core/auth/session.model';

export type TravelPace = 'RELAXED' | 'BALANCED' | 'PACKED';

export interface TravelProfile {
  homeLocation: { id: string; name: string; slug: string; state: string } | null;
  interests: string[];
  pace: TravelPace;
  dietaryPreference: string | null;
  budgetBand: string | null;
  preferredTravelMode: string | null;
  defaultUserVehicle: { id: string; label: string } | null;
  marketingOptIn: boolean;
}

export interface Me extends SessionUser {
  phoneVerifiedAt: string | null;
  createdAt: string;
  profile: TravelProfile;
}

export interface ProfileUpdate {
  homeLocationId?: string | null;
  interests?: string[];
  pace?: TravelPace;
  dietaryPreference?: string | null;
  budgetBand?: string | null;
  preferredTravelMode?: string | null;
  defaultUserVehicleId?: string | null;
  marketingOptIn?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MeApiService {
  private readonly api = inject(ApiService);

  get(): Observable<Me> {
    return this.api.get<Me>('/me');
  }

  update(input: { name?: string; phone?: string | null }): Observable<Me> {
    return this.api.patch<Me, typeof input>('/me', input);
  }

  updateProfile(input: ProfileUpdate): Observable<Me> {
    return this.api.patch<Me, ProfileUpdate>('/me/profile', input);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse, { currentPassword: string; newPassword: string }>(
      '/me/password',
      { currentPassword, newPassword }
    );
  }

  deleteAccount(password: string): Observable<{ deleted: boolean }> {
    return this.api.deleteWithBody<{ deleted: boolean }, { password: string }>('/me', { password });
  }
}
