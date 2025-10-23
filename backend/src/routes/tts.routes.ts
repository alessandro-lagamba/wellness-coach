/**
 * TTS Routes
 */

import { Router } from 'express';
import { synthesizeTTS } from '../controllers/tts.controller';

const router: Router = Router();

router.post('/synthesize', synthesizeTTS);

export default router;
