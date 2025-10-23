/**
 * Emotion Analysis Routes
 */

import { Router } from 'express';
import { analyzeEmotion, getEmotionHistory } from '../controllers/emotion.controller';

const router: Router = Router();

// POST /api/emotion/analyze - Analyze emotion from image or text
router.post('/analyze', analyzeEmotion);

// GET /api/emotion/history - Get emotion history for a session
router.get('/history', getEmotionHistory);

export default router;
