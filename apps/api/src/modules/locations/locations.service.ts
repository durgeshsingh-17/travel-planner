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
      const q = query.q?.trim();

      if (q) {
        // Name or alias match ("Gurgaon" finds Gurugram), best prefix matches first.
        const ids = await this.searchIds(q, limit, query.state);
        const locations = await this.prisma.location.findMany({ where: { id: { in: ids } } });

        return ids
          .map((id) => locations.find((location) => location.id === id))
          .filter((location): location is Location => Boolean(location))
          .map((location) => this.serialize(location));
      }

      const locations = await this.prisma.location.findMany({
        where: { isActive: true, state: query.state },
        take: limit,
        orderBy: [{ popularity: 'desc' }, { state: 'asc' }, { name: 'asc' }]
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

  /** Active locations whose name, state or any alias contains `q`, ranked for typeahead. */
  async searchIds(q: string, limit: number, state?: string): Promise<string[]> {
    const escaped = q.replace(/[\\%_]/g, (char) => `\\${char}`);
    const contains = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Location"
      WHERE "isActive" = true
        AND (${state ?? null}::text IS NULL OR "state" = ${state ?? null})
        AND (
          "name" ILIKE ${contains}
          OR "state" ILIKE ${contains}
          OR EXISTS (SELECT 1 FROM unnest("aliases") AS alias WHERE alias ILIKE ${contains})
        )
      ORDER BY
        ("name" ILIKE ${prefix} OR EXISTS (SELECT 1 FROM unnest("aliases") AS alias WHERE alias ILIKE ${prefix})) DESC,
        "popularity" DESC,
        "name" ASC
      LIMIT ${limit}
    `);

    return rows.map((row) => row.id);
  }

  private serialize(location: Location) {
    return {
      ...location,
      latitude: decimalToNumber(location.latitude),
      longitude: decimalToNumber(location.longitude)
    };
  }
}
