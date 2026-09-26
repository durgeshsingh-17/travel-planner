import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, UserProfile } from '@prisma/client';

import { AuthService, ClientContext } from '../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const profileInclude = {
  homeLocation: {
    select: { id: true, name: true, slug: true, state: true }
  },
  defaultUserVehicle: {
    select: {
      id: true,
      nickname: true,
      vehicle: { select: { brand: true, model: true } }
    }
  }
} satisfies Prisma.UserProfileInclude;

type ProfileWithRelations = Prisma.UserProfileGetPayload<{ include: typeof profileInclude }>;

export interface SerializedProfile {
  homeLocation: ProfileWithRelations['homeLocation'];
  interests: string[];
  pace: UserProfile['pace'];
  dietaryPreference: string | null;
  budgetBand: string | null;
  preferredTravelMode: UserProfile['preferredTravelMode'];
  defaultUserVehicle: { id: string; label: string } | null;
  marketingOptIn: boolean;
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: profileInclude } }
    });

    if (!user) {
      // The access token outlived the account (deleted in the last few minutes).
      throw new UnauthorizedException('Session is no longer valid');
    }

    return {
      ...this.authService.serializeUser(user),
      createdAt: user.createdAt.toISOString(),
      profile: this.serializeProfile(user.profile)
    };
  }

  async update(userId: string, dto: UpdateMeDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone,
        avatarUrl: dto.avatarUrl
      }
    });

    return this.get(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.homeLocationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.homeLocationId, isActive: true },
        select: { id: true }
      });

      if (!location) {
        throw new BadRequestException('Home city was not found');
      }
    }

    if (dto.defaultUserVehicleId) {
      const vehicle = await this.prisma.userVehicle.findFirst({
        where: { id: dto.defaultUserVehicleId, userId },
        select: { id: true }
      });

      if (!vehicle) {
        throw new BadRequestException('Default vehicle must be one of your saved vehicles');
      }
    }

    const data = {
      homeLocationId: dto.homeLocationId,
      interests: dto.interests?.map((interest) => interest.trim()).filter(Boolean),
      pace: dto.pace,
      dietaryPreference: dto.dietaryPreference,
      budgetBand: dto.budgetBand,
      preferredTravelMode: dto.preferredTravelMode,
      defaultUserVehicleId: dto.defaultUserVehicleId,
      marketingOptIn: dto.marketingOptIn
    } satisfies Prisma.UserProfileUncheckedUpdateInput;

    await this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    });

    return this.get(userId);
  }

  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    client: ClientContext
  ) {
    return this.authService.changePassword(userId, currentPassword, newPassword, client);
  }

  /** Permanently deletes the account and every trip it owns (traveller details included). */
  async delete(userId: string, password: string) {
    await this.authService.assertPassword(userId, password);

    await this.prisma.$transaction([
      this.prisma.trip.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } })
    ]);

    return { deleted: true };
  }

  private serializeProfile(profile: ProfileWithRelations | null): SerializedProfile {
    if (!profile) {
      return this.emptyProfile();
    }

    return {
      homeLocation: profile.homeLocation,
      interests: profile.interests,
      pace: profile.pace,
      dietaryPreference: profile.dietaryPreference,
      budgetBand: profile.budgetBand,
      preferredTravelMode: profile.preferredTravelMode,
      defaultUserVehicle: profile.defaultUserVehicle
        ? {
            id: profile.defaultUserVehicle.id,
            label:
              profile.defaultUserVehicle.nickname ??
              `${profile.defaultUserVehicle.vehicle.brand} ${profile.defaultUserVehicle.vehicle.model}`
          }
        : null,
      marketingOptIn: profile.marketingOptIn
    };
  }

  private emptyProfile(): SerializedProfile {
    return {
      homeLocation: null,
      interests: [],
      pace: 'BALANCED',
      dietaryPreference: null,
      budgetBand: null,
      preferredTravelMode: null,
      defaultUserVehicle: null,
      marketingOptIn: false
    };
  }
}
