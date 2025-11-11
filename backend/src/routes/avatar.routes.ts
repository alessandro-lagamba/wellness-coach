/**
 * Avatar Routes - Secure Token-Based Avatar Services
 * All avatar services are proxied through backend for security
 */

import { Router } from 'express';
import multer from 'multer';
import {
  getSimliToken,
  simliSpeak,
  getA2EToken,
  generateRPMAvatar,
  getAvatarStatus,
  validateAvatarRequest,
  generateAvatarFromPhoto
} from '../controllers/avatar.controller';

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

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

// Generate stylized avatar from user photo
router.post('/generate', upload.single('photo'), generateAvatarFromPhoto);

// ========================================
// GENERAL ROUTES
// ========================================

// Get avatar services status
router.get('/status', getAvatarStatus);

export default router;
