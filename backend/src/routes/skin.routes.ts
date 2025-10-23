/**
 * Skin Analysis Routes
 */

import { Router } from 'express';
import { analyzeSkin, getSkinHistory } from '../controllers/skin.controller';

const router: Router = Router();

// POST /api/skin/analyze - Analyze skin from image
router.post('/analyze', analyzeSkin);

// GET /api/skin/history - Get skin analysis history for a session
router.get('/history', getSkinHistory);

export default router;
