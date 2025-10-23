/**
 * Coaching Rules - Stub for Sprint #2
 */

export interface CoachingRule {
  id: string;
  condition: string;
  action: string;
}

export const coachingRules: CoachingRule[] = [];

export const getCoachingRules = (): CoachingRule[] => coachingRules;
