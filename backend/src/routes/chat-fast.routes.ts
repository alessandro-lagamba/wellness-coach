import express, { Request, Response } from 'express';

const router: express.Router = express.Router();

// Placeholder: Gemini streaming integration removed. This endpoint is temporarily unavailable.
router.post('/fast', async (_req: Request, res: Response) => {
	return res.status(501).json({
		success: false,
		error: 'Fast chat (Gemini streaming) non disponibile. Integrazione rimossa temporaneamente.'
	});
});

export default router;
