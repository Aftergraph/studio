/**
 * X-Request-ID middleware.
 * Generates a unique ID per request if not already present.
 */
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
