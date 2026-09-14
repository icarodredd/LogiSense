import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_RULE_MESSAGE } from '../users/user.dto.js';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  tenantName!: string;

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
}

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  // Fase 4 (MFA/TOTP): código do autenticador quando a conta exige MFA.
  @IsOptional()
  @IsString()
  totpCode?: string;
}
