import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AppRole } from './roles.decorator.js';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: AppRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthenticatedUser;
  },
);
