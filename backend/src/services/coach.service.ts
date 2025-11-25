/**
 * Coach Service
 * Contextual health coaching suggestions with actionable CTAs
 */

import OpenAI from "openai";
import { UserState, CoachResp, CoachSuggestion } from "../types/nutrition.types";
import { systemGuardrails, coachPrompt } from "./ai/prompt";
import { coachSchema } from "./ai/schemas";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Generate contextual coaching suggestion based on user state
 */
export async function coachHook(state: UserState): Promise<CoachResp> {
  try {
    console.log("[Coach] 🧭 Generating coaching suggestion...", {
      remainingCalories: state.remainingCalories,
      category: "nutrition",
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: coachSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        { role: "user", content: coachPrompt(state) },
      ],
      temperature: 0.2,
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content) as CoachSuggestion;

    // Set expiration (default: 6 hours from now)
    if (!data.expireAt) {
      const expireDate = new Date();
      expireDate.setHours(expireDate.getHours() + 6);
      data.expireAt = expireDate.toISOString();
    }

    console.log("[Coach] ✅ Suggestion generated:", {
      title: data.title,
      category: data.category,
      priority: data.priority,
    });

    return { success: true, suggestion: data };
  } catch (e: any) {
    console.error("[Coach] ❌ coachHook failed:", e);
    
    // Retry with lower temperature if first attempt fails
    try {
      console.log("[Coach] 🔄 Retrying with lower temperature...");
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: {
          type: "json_schema",
          json_schema: coachSchema as any,
        },
        messages: [
          { role: "system", content: systemGuardrails },
          { role: "user", content: coachPrompt(state) },
        ],
        temperature: 0,
      });

      const content = res.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const data = JSON.parse(content) as CoachSuggestion;

      if (!data.expireAt) {
        const expireDate = new Date();
        expireDate.setHours(expireDate.getHours() + 6);
        data.expireAt = expireDate.toISOString();
      }

      return { success: true, suggestion: data };
    } catch (retryError: any) {
      console.error("[Coach] ❌ Retry also failed:", retryError);
      return {
        success: false,
        error: retryError.message ?? "coach failed",
      };
    }
  }
}






