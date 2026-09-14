import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { UserRole, UserStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/http/pagination.js';

export const PASSWORD_RULE_MESSAGE =
  'A senha deve ter ao menos 8 caracteres, com letras e números.';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: PASSWORD_RULE_MESSAGE })
  password!: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'MANAGER', 'OPERATOR'] as UserRole[])
  role?: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'SUSPENDED'] as UserStatus[])
  status?: UserStatus;

  @IsOptional()
  @IsEnum(['ADMIN', 'MANAGER', 'OPERATOR'] as UserRole[])
  role?: UserRole;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
