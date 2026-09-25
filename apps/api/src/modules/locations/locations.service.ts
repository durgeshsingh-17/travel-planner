import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Location, Prisma } from '@prisma/client';

import { decimalToNumber } from '../../common/utils/number.util';
import { ListLocationsQueryDto } from './dto/list-locations-query.dto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListLocationsQueryDto) {
    const limit = query.limit ? Math.min(Math.max(query.limit, 1), 100) : 100;

    try {
      const locations = await this.prisma.location.findMany({
        where: {
          isActive: true,
          state: query.state,
          OR: query.q
            ? [
                {
                  name: {
                    contains: query.q,
                    mode: 'insensitive'
                  }
                },
                {
                  state: {
                    contains: query.q,
                    mode: 'insensitive'
                  }
                },
                {
                  country: {
                    contains: query.q,
                    mode: 'insensitive'
                  }
                }
              ]
            : undefined
        },
        take: limit,
        orderBy: [{ state: 'asc' }, { name: 'asc' }]
      });

      return locations.map((location) => this.serialize(location));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2021', 'P2022'].includes(error.code)
      ) {
        throw new ServiceUnavailableException(
          'Locations table is not available. Run Prisma migrations and seed the database.'
        );
      }

      throw error;
    }
  }

  private serialize(location: Location) {
    return {
      ...location,
      latitude: decimalToNumber(location.latitude),
      longitude: decimalToNumber(location.longitude)
    };
  }
}
