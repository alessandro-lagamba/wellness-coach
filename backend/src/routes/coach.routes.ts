/**
 * Coach Routes
 */

import { Router } from "express";
import { getCoachSuggestion } from "../controllers/coach.controller";

const router: Router = Router();

// POST /api/coach/suggest - Get contextual coaching suggestion
router.post("/suggest", getCoachSuggestion);

export default router;




