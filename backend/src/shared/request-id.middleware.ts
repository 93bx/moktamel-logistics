import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function RequestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existing = req.header('x-request-id');
  const requestId = existing && existing.length > 0 ? existing : randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as any).request_id = requestId;
  next();
}


