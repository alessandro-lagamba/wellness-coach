/**
 * Basic Rate Limiting Middleware
 * Protegge da abusi e sovraccarico
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Configurazione rate limit
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minuti default
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10); // 100 richieste default

function getClientIdentifier(req: Request): string {
  // Usa IP address come identificatore
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.socket.remoteAddress || 'unknown';
  return ip;
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Cleanup periodico (ogni 100 richieste)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  const clientId = getClientIdentifier(req);
  const now = Date.now();

  // Inizializza o resetta se scaduto
  if (!store[clientId] || store[clientId].resetTime < now) {
    store[clientId] = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  // Incrementa contatore
  store[clientId].count++;

  // Verifica limite
  if (store[clientId].count > RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = Math.ceil((store[clientId].resetTime - now) / 1000);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
      retryAfter: resetIn,
    });
    return;
  }

  // Aggiungi headers informativi
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - store[clientId].count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(store[clientId].resetTime).toISOString());

  next();
}

