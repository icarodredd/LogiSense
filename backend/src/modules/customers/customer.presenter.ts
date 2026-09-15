import type { Customer } from '@prisma/client';

export interface CustomerResponse {
  id: string;
  tenantId: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: Customer['status'];
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    tenantId: customer.tenantId,
    name: customer.name,
    document: customer.document,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    state: customer.state,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
