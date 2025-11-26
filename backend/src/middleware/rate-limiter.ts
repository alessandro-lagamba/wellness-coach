/**
 * Rate Limiting Middleware
 * Protegge da abusi, brute force e sovraccarico
 * 
 * Due livelli:
 * - Standard: 100 richieste / 15 minuti (default)
 * - Strict: 10 richieste / 15 minuti (login, generazione ricette, etc.)
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const strictStore: RateLimitStore = {}; // Store separato per rate limit strict

// Configurazione rate limit standard
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minuti default
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10); // 100 richieste default

// Configurazione rate limit strict (per endpoint critici)
const STRICT_RATE_LIMIT_WINDOW_MS = parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minuti
const STRICT_RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS || '10', 10); // 10 richieste

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
  Object.keys(strictStore).forEach(key => {
    if (strictStore[key].resetTime < now) {
      delete strictStore[key];
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

/**
 * Rate limiter STRICT per endpoint critici (login, generazione ricette, etc.)
 * Limite più basso per prevenire brute force e abusi costosi
 */
export function strictRateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Cleanup periodico
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  const clientId = getClientIdentifier(req);
  const now = Date.now();

  // Inizializza o resetta se scaduto
  if (!strictStore[clientId] || strictStore[clientId].resetTime < now) {
    strictStore[clientId] = {
      count: 0,
      resetTime: now + STRICT_RATE_LIMIT_WINDOW_MS,
    };
  }

  // Incrementa contatore
  strictStore[clientId].count++;

  // Verifica limite (più restrittivo)
  if (strictStore[clientId].count > STRICT_RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = Math.ceil((strictStore[clientId].resetTime - now) / 1000);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: `Rate limit exceeded for this endpoint. Try again in ${resetIn} seconds.`,
      retryAfter: resetIn,
    });
    return;
  }

  // Aggiungi headers informativi
  res.setHeader('X-RateLimit-Limit', STRICT_RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, STRICT_RATE_LIMIT_MAX_REQUESTS - strictStore[clientId].count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(strictStore[clientId].resetTime).toISOString());
  res.setHeader('X-RateLimit-Type', 'strict');

  next();
}

