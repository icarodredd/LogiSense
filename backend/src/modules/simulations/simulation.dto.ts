import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/http/pagination.js';
import { SimulationStatus } from '@prisma/client';

export class CreateSimulationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  origin!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @IsPositive()
  weightKg!: number;

  @IsPositive()
  @Min(1)
  lengthCm!: number;

  @IsPositive()
  @Min(1)
  widthCm!: number;

  @IsPositive()
  @Min(1)
  heightCm!: number;

  @IsNumber()
  @Min(0)
  cargoValue!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  customerId?: string;
}

export class ListSimulationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(['COMPLETED', 'CANCELLED'] as SimulationStatus[])
  status?: SimulationStatus;
}
