import { Injectable } from '@nestjs/common';

import { WeatherQueryDto } from './dto/weather-query.dto';

@Injectable()
export class WeatherService {
  status() {
    return {
      enabled: true,
      provider: 'open-meteo-compatible',
      message: 'Weather forecast endpoint is available without an API key'
    };
  }

  async forecast(query: WeatherQueryDto) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(query.latitude));
    url.searchParams.set('longitude', String(query.longitude));
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather provider returned ${response.status}`);
      }

      const payload = (await response.json()) as {
        daily?: {
          time?: string[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_probability_max?: number[];
        };
      };

      return {
        location: query.location,
        provider: 'open-meteo',
        days:
          payload.daily?.time?.map((date, index) => ({
            date,
            minTemperatureC: payload.daily?.temperature_2m_min?.[index] ?? null,
            maxTemperatureC: payload.daily?.temperature_2m_max?.[index] ?? null,
            precipitationProbability:
              payload.daily?.precipitation_probability_max?.[index] ?? null
          })) ?? []
      };
    } catch {
      return {
        location: query.location,
        provider: 'fallback',
        days: this.fallbackForecast(query.startDate)
      };
    }
  }

  private fallbackForecast(startDate?: string) {
    const baseDate = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date();

    return Array.from({ length: 5 }).map((_, index) => {
      const date = new Date(baseDate);
      date.setUTCDate(baseDate.getUTCDate() + index);

      return {
        date: date.toISOString().slice(0, 10),
        minTemperatureC: 9 + index,
        maxTemperatureC: 20 + index,
        precipitationProbability: index % 2 === 0 ? 10 : 25
      };
    });
  }
}
