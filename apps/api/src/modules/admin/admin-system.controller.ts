import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminUsersService } from './admin-users.service';
import { AuditQueryDto, SetRoleDto } from './dto/admin.dto';
import { AuditService } from '../content/audit.service';
import { CurrentUserId } from '../auth/current-user.decorator';
import { ImportBundleDto, ImportCsvDto } from './dto/import.dto';
import { ImportService } from './import.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin')
@Roles('ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminSystemController {
  constructor(
    private readonly imports: ImportService,
    private readonly audit: AuditService,
    private readonly users: AdminUsersService
  ) {}

  /** JSON bundle of tags, destinations, places and collections. Defaults to a dry run. */
  @Post('imports')
  importBundle(
    @Body() bundle: ImportBundleDto,
    @CurrentUserId() actorId: string,
    @Query('dryRun', new ParseBoolPipe({ optional: true })) dryRun = true
  ) {
    return this.imports.importBundle(bundle, { dryRun, actorId });
  }

  @Post('imports/csv')
  importCsv(
    @Body() dto: ImportCsvDto,
    @CurrentUserId() actorId: string,
    @Query('dryRun', new ParseBoolPipe({ optional: true })) dryRun = true
  ) {
    return this.imports.importCsv(dto.entity, dto.csv, { dryRun, actorId });
  }

  @Roles('EDITOR', 'ADMIN')
  @Get('audit-log')
  auditLog(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @Get('users')
  listUsers(@Query('q') q?: string) {
    return this.users.list(q?.slice(0, 80));
  }

  @Patch('users/:id/role')
  setRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetRoleDto,
    @CurrentUserId() actorId: string
  ) {
    return this.users.setRole(actorId, id, dto.role);
  }
}
