import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

import { INDIA_PHONE_PATTERN } from '../../../common/validators/identity.patterns';

export class AgentDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase letters, numbers and single hyphens' })
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsEmail()
  email!: string;

  @Matches(INDIA_PHONE_PATTERN, { message: 'Enter a valid Indian mobile number' })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  /** State names; leave empty for agencies that serve all of India. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(36)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  serviceStates?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxOpenLeads?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /** Email of an existing user who answers requests for this agency. */
  @IsOptional()
  @IsEmail()
  userEmail?: string | null;
}

export class AssignAgentsDto {
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('all', { each: true })
  agentIds!: string[];
}
