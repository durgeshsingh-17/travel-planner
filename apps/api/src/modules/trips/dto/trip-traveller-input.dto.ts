import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { TravellerGender } from '@prisma/client';

export class TripTravellerInputDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsInt()
  @Min(0)
  @Max(120)
  age!: number;

  @IsEnum(TravellerGender)
  gender!: TravellerGender;
}
