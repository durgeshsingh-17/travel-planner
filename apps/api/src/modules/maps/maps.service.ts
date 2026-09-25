import { Injectable } from '@nestjs/common';

import { RouteQueryDto } from './dto/route-query.dto';

@Injectable()
export class MapsService {
  status() {
    return {
      enabled: true,
      provider: 'openstreetmap-embed',
      message: 'Map-ready route metadata is available for frontend rendering'
    };
  }

  route(query: RouteQueryDto) {
    const minLatitude = Math.min(query.sourceLatitude, query.destinationLatitude) - 0.6;
    const maxLatitude = Math.max(query.sourceLatitude, query.destinationLatitude) + 0.6;
    const minLongitude = Math.min(query.sourceLongitude, query.destinationLongitude) - 0.6;
    const maxLongitude = Math.max(query.sourceLongitude, query.destinationLongitude) + 0.6;

    return {
      source: {
        name: query.sourceName,
        latitude: query.sourceLatitude,
        longitude: query.sourceLongitude
      },
      destination: {
        name: query.destinationName,
        latitude: query.destinationLatitude,
        longitude: query.destinationLongitude
      },
      bounds: {
        minLatitude,
        maxLatitude,
        minLongitude,
        maxLongitude
      },
      embedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}&layer=mapnik&marker=${query.destinationLatitude},${query.destinationLongitude}`
    };
  }
}
