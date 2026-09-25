import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { decimalToNumber } from '../../common/utils/number.util';
import { ListPlacesQueryDto } from './dto/list-places-query.dto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPlacesQueryDto) {
    const where: Prisma.PlaceWhereInput = {
      category: query.category,
      destination: query.destinationSlug
        ? {
            slug: query.destinationSlug
          }
        : undefined
    };

    const places = await this.prisma.place.findMany({
      where,
      include: {
        destination: {
          select: {
            id: true,
            name: true,
            slug: true,
            state: true,
            country: true
          }
        }
      },
      orderBy: [{ destination: { name: 'asc' } }, { category: 'asc' }, { name: 'asc' }]
    });

    return places.map((place) => ({
      ...place,
      latitude: decimalToNumber(place.latitude),
      longitude: decimalToNumber(place.longitude),
      estimatedCost: decimalToNumber(place.estimatedCost),
      rating: decimalToNumber(place.rating)
    }));
  }
}
