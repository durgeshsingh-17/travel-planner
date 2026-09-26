import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUserId } from '../auth/current-user.decorator';
import { CreateUserVehicleDto } from './dto/create-user-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateUserVehicleDto } from './dto/update-user-vehicle.dto';
import { VehiclesService } from './vehicles.service';
import { Public } from '../auth/public.decorator';

@ApiTags('vehicles')
@Controller({
  path: 'vehicles',
  version: '1'
})
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get('my')
  findMine(@CurrentUserId() userId: string) {
    return this.vehiclesService.findUserVehicles(userId);
  }

  @Post('my')
  createMine(@CurrentUserId() userId: string, @Body() dto: CreateUserVehicleDto) {
    return this.vehiclesService.createUserVehicle(userId, dto);
  }

  @Patch('my/:id')
  updateMine(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserVehicleDto
  ) {
    return this.vehiclesService.updateUserVehicle(userId, id, dto);
  }

  @Put('my/:id')
  replaceMine(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserVehicleDto
  ) {
    return this.vehiclesService.updateUserVehicle(userId, id, dto);
  }

  @Delete('my/:id')
  deleteMine(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.vehiclesService.deleteUserVehicle(userId, id);
  }
}
