/**
 * Avatar Routes - Secure Token-Based Avatar Services
 * All avatar services are proxied through backend for security
 */

import { Router } from 'express';
import {
  getSimliToken,
  simliSpeak,
  getA2EToken,
  generateRPMAvatar,
  getAvatarStatus,
  validateAvatarRequest
} from '../controllers/avatar.controller';

const router: Router = Router();

// Apply rate limiting to all avatar routes
router.use(validateAvatarRequest);

// ========================================
// SIMLI ROUTES
// ========================================

// Get ephemeral Simli token
router.get('/simli/token', getSimliToken);

// Proxy Simli speak request
router.post('/simli/speak', simliSpeak);

// ========================================
// A2E ROUTES
// ========================================

// Get ephemeral A2E token
router.get('/a2e/token', getA2EToken);

// ========================================
// READY PLAYER ME ROUTES
// ========================================

// Generate RPM avatar
router.post('/rpm/generate', generateRPMAvatar);

// ========================================
// GENERAL ROUTES
// ========================================

// Get avatar services status
router.get('/status', getAvatarStatus);

export default router;
