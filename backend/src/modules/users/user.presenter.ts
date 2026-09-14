import type { User } from '@prisma/client';

export interface UserResponse {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: User['role'];
  status: User['status'];
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
