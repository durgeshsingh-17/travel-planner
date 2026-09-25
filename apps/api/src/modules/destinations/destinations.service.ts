import { Injectable, NotFoundException } from '@nestjs/common';
import { Destination } from '@prisma/client';

import { decimalToNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';

interface ListDestinationsQuery {
  state?: string;
  q?: string;
  limit?: number;
}

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListDestinationsQuery) {
    const limit = query.limit ? Math.min(Math.max(query.limit, 1), 100) : 50;

    const destinations = await this.prisma.destination.findMany({
      where: {
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

    return destinations.map((destination) => this.serialize(destination));
  }

  async findBySlug(slug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      include: {
        places: {
          orderBy: [{ category: 'asc' }, { name: 'asc' }]
        }
      }
    });

    if (!destination) {
      throw new NotFoundException(`Destination '${slug}' was not found`);
    }

    return {
      ...this.serialize(destination),
      places: destination.places.map((place) => ({
        ...place,
        latitude: decimalToNumber(place.latitude),
        longitude: decimalToNumber(place.longitude),
        estimatedCost: decimalToNumber(place.estimatedCost),
        rating: decimalToNumber(place.rating)
      }))
    };
  }

  private serialize(destination: Destination) {
    return {
      ...destination,
      latitude: decimalToNumber(destination.latitude),
      longitude: decimalToNumber(destination.longitude)
    };
  }
}
