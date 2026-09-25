import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { CreateUserVehicleDto } from './dto/create-user-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@Controller({
  path: 'vehicles',
  version: '1'
})
export class VehiclesController {
  constructor(
    private readonly authService: AuthService,
    private readonly vehiclesService: VehiclesService
  ) {}

  @Get()
  findAll(@Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get('my')
  findMine(@Headers('authorization') authorization?: string) {
    return this.vehiclesService.findUserVehicles(
      this.authService.resolveUserIdFromAuthorization(authorization)
    );
  }

  @Post('my')
  createMine(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: CreateUserVehicleDto
  ) {
    return this.vehiclesService.createUserVehicle(
      this.authService.resolveUserIdFromAuthorization(authorization),
      dto
    );
  }

  @Delete('my/:id')
  deleteMine(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string
  ) {
    return this.vehiclesService.deleteUserVehicle(
      this.authService.resolveUserIdFromAuthorization(authorization),
      id
    );
  }
}
