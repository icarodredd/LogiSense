import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/http/pagination.js';

export class CreateCarrierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  document?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsNumber()
  @Min(0)
  baseFee!: number;

  @IsNumber()
  @Min(0.01)
  pricePerKg!: number;

  @IsNumber()
  @Min(0)
  pricePerKm!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  riskPercent!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cubingFactor?: number;
}

export class UpdateCarrierDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  document?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  pricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  riskPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cubingFactor?: number;

  @IsOptional()
  active?: boolean;
}

export class ListCarriersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  active?: boolean;
}
