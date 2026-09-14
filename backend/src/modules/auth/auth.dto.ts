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

  // Obrigatório quando a conta tem MFA ativo (MFA_REQUIRED sem ele).
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código TOTP deve ter 6 dígitos.' })
  totpCode?: string;
}

export class ConfirmMfaDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código TOTP deve ter 6 dígitos.' })
  totpCode!: string;
}

export class DisableMfaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código TOTP deve ter 6 dígitos.' })
  totpCode!: string;
}
