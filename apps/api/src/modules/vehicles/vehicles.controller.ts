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
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { CreateUserVehicleDto } from './dto/create-user-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateUserVehicleDto } from './dto/update-user-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@Controller({
  path: 'vehicles',
  version: '1'
})
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll(@Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get('my')
  @UseGuards(AuthGuard)
  findMine(@CurrentUserId() userId: string) {
    return this.vehiclesService.findUserVehicles(userId);
  }

  @Post('my')
  @UseGuards(AuthGuard)
  createMine(@CurrentUserId() userId: string, @Body() dto: CreateUserVehicleDto) {
    return this.vehiclesService.createUserVehicle(userId, dto);
  }

  @Patch('my/:id')
  @UseGuards(AuthGuard)
  updateMine(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserVehicleDto
  ) {
    return this.vehiclesService.updateUserVehicle(userId, id, dto);
  }

  @Put('my/:id')
  @UseGuards(AuthGuard)
  replaceMine(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserVehicleDto
  ) {
    return this.vehiclesService.updateUserVehicle(userId, id, dto);
  }

  @Delete('my/:id')
  @UseGuards(AuthGuard)
  deleteMine(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.vehiclesService.deleteUserVehicle(userId, id);
  }
}
