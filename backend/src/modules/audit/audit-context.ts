import type { Request } from 'express';
import type { RequestWithId } from '../../common/http/request-with-id.js';
import type { AuditContext } from './audit.service.js';

export function extractAuditContext(req: Request): AuditContext {
  const withId = req as Partial<RequestWithId>;
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
    req.socket?.remoteAddress;
  return {
    ip,
    userAgent: req.headers['user-agent'],
    requestId: withId.requestId,
  };
}
