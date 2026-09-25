import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { WeatherQueryDto } from './dto/weather-query.dto';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@Controller({
  path: 'weather',
  version: '1'
})
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('status')
  status() {
    return this.weatherService.status();
  }

  @Get('forecast')
  forecast(@Query() query: WeatherQueryDto) {
    return this.weatherService.forecast(query);
  }
}
