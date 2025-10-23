/**
 * Chat Routes - LLM Chat Integration
 */

import { Router } from 'express';
import { respondToChat } from '../controllers/chat.controller';

const router: Router = Router();

// Chat endpoint
router.post('/respond', respondToChat);

export default router;
