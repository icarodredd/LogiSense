import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { TenantsController } from '../tenants/tenants.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MfaService } from './mfa.service.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [JwtModule.register({}), AuditModule, UsersModule],
  controllers: [AuthController, TenantsController, OAuthController],
  providers: [AuthService, TokenService, MfaService, OAuthService],
  // JwtModule reexportado para que o JwtAuthGuard (APP_GUARD no AppModule)
  // consiga injetar o JwtService.
  exports: [TokenService, JwtModule, MfaService],
})
export class AuthModule {}
