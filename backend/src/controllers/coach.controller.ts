/**
 * Coach Controller
 * Handles contextual health coaching suggestions
 */

import { Request, Response } from "express";
import { UserState } from "../types/nutrition.types";
import { coachHook } from "../services/coach.service";

/**
 * POST /api/coach/suggest
 * Generate contextual coaching suggestion based on user state
 */
export const getCoachSuggestion = async (req: Request, res: Response) => {
  try {
    const state: UserState = req.body;

    // Validate required fields
    if (typeof state.remainingCalories !== "number" || !state.dateISO) {
      return res.status(400).json({
        success: false,
        error: "remainingCalories and dateISO are required",
      });
    }

    const result = await coachHook(state);

    if (result.success) {
      res.json({
        success: true,
        data: result.suggestion,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("[Coach] ❌ getCoachSuggestion controller error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};



