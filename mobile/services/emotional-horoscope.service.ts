/**
 * Emotional Horoscope Service
 * 
 * Creates an "Oroscopo (non richiesto)" - The Horoscope You Didn't Ask For
 * Maps emotion analysis results to 8 archetypal roles using deterministic logic,
 * then generates engaging narrative text via OpenAI.
 * 
 * This is NOT astrology, NOT diagnosis, NOT therapy. It is a game of introspection.
 */

import { API_CONFIG } from '../config/api.config';
import { getUserLanguage, getLanguageInstruction } from './language.service';

// =============================================================================
// TYPES
// =============================================================================

export type EmotionalRole =
    | 'il_regista_con_il_budget'
    | 'l_equilibrista'
    | 'in_modalita_risparmio'
    | 'il_silente'
    | 'un_concerto_metal'
    | 'segnale_infrasuono'
    | 'motore_a_propulsione'
    | 'l_attore_senza_oscar';

export interface EmotionInput {
    dominant_emotion: string;
    emotions: {
        joy?: number;
        sadness?: number;
        anger?: number;
        fear?: number;
        surprise?: number;
        disgust?: number;
        neutral?: number;
    };
    valence: number;  // -1 to 1
    arousal: number;  // -1 to 1
    confidence: number; // 0 to 1
}

export interface RoleMetadata {
    id: EmotionalRole;
    titleIT: string;
    titleEN: string;
    subtitleIT: string;
    subtitleEN: string;
    descriptionIT: string;
    descriptionEN: string;
    gradientColors: [string, string, string];
    emoji: string; // Temporary placeholder
}

export interface HoroscopeResult {
    role: EmotionalRole;
    metadata: RoleMetadata;
    horoscopeText: string;
    generatedAt: Date;
}

// =============================================================================
// ROLE METADATA
// =============================================================================

export const ROLE_METADATA: Record<EmotionalRole, RoleMetadata> = {
    il_regista_con_il_budget: {
        id: 'il_regista_con_il_budget',
        titleIT: 'Il Regista con il Budget',
        titleEN: 'The Director',
        subtitleIT: 'Visione e azione in sintonia',
        subtitleEN: 'Vision meets action',
        descriptionIT: 'Oggi tieni insieme visione e azione. L\'energia non è rumore, è direzione.',
        descriptionEN: 'Today you hold vision and action together. Energy is not noise, it is direction.',
        gradientColors: ['#1a1a2e', '#16213e', '#0f3460'],
        emoji: '🎬',
    },
    l_equilibrista: {
        id: 'l_equilibrista',
        titleIT: 'L\'Equilibrista',
        titleEN: 'The Balancer',
        subtitleIT: 'Armonia tra sentire e fare',
        subtitleEN: 'Harmony between feeling and doing',
        descriptionIT: 'Oggi c\'è una buona armonia tra quello che senti e quello che fai. Ma l\'apparenza può ingannare.',
        descriptionEN: 'Today there is good harmony between what you feel and what you do. But appearances can be deceiving.',
        gradientColors: ['#2d3436', '#636e72', '#b2bec3'],
        emoji: '⚖️',
    },
    in_modalita_risparmio: {
        id: 'in_modalita_risparmio',
        titleIT: 'In Modalità Risparmio',
        titleEN: 'Power Saving Mode',
        subtitleIT: 'Energie con cautela',
        subtitleEN: 'Careful with energy',
        descriptionIT: 'Oggi stai usando le energie con cautela. Non è il giorno per forzare: funziona meglio fare meno, ma bene.',
        descriptionEN: 'Today you are using energy carefully. This is not the day to push: doing less but well works better.',
        gradientColors: ['#1e3c72', '#2a5298', '#4a7c9b'],
        emoji: '🔋',
    },
    il_silente: {
        id: 'il_silente',
        titleIT: 'Il Silente',
        titleEN: 'The Silent One',
        subtitleIT: 'Le cose parlano poco',
        subtitleEN: 'Things speak little',
        descriptionIT: 'Oggi le cose parlano poco. Anche questo è un modo di stare.',
        descriptionEN: 'Today things speak little. This too is a way of being.',
        gradientColors: ['#0f0f23', '#1a1a3e', '#2d2d5a'],
        emoji: '🌫️',
    },
    un_concerto_metal: {
        id: 'un_concerto_metal',
        titleIT: 'Un Concerto Metal',
        titleEN: 'A Metal Concert',
        subtitleIT: 'Tanti pensieri, sottofondo costante',
        subtitleEN: 'Many thoughts, constant background',
        descriptionIT: 'Tanti pensieri e un sottofondo costante che ti distrae. Oggi la mente sta facendo multitasking anche quando non serve.',
        descriptionEN: 'Many thoughts and a constant background distracting you. Today the mind is multitasking even when not needed.',
        gradientColors: ['#1a1a1a', '#2d2d2d', '#404040'],
        emoji: '🎸',
    },
    segnale_infrasuono: {
        id: 'segnale_infrasuono',
        titleIT: 'Segnale Infrasuono',
        titleEN: 'Infrasound Signal',
        subtitleIT: 'Sistema molto reattivo',
        subtitleEN: 'Highly reactive system',
        descriptionIT: 'Il sistema è molto reattivo oggi. Utile per cogliere segnali, meno per stare in pace. Abbassare la sensibilità non è un fallimento.',
        descriptionEN: 'The system is very reactive today. Useful for catching signals, less for staying at peace. Lowering sensitivity is not a failure.',
        gradientColors: ['#1a0a2e', '#2d1b4e', '#4a2c7a'],
        emoji: '📡',
    },
    motore_a_propulsione: {
        id: 'motore_a_propulsione',
        titleIT: 'Motore a Propulsione',
        titleEN: 'Propulsion Engine',
        subtitleIT: 'Energia alta e concentrata',
        subtitleEN: 'High and focused energy',
        descriptionIT: 'Oggi l\'energia è alta e concentrata. Spinge in avanti con forza, ma chiede una direzione chiara per non disperdersi.',
        descriptionEN: 'Today energy is high and focused. It pushes forward powerfully, but asks for a clear direction not to disperse.',
        gradientColors: ['#2d1f1f', '#4a2828', '#6b3535'],
        emoji: '🚀',
    },
    l_attore_senza_oscar: {
        id: 'l_attore_senza_oscar',
        titleIT: 'L\'Attore Senza Oscar',
        titleEN: 'The Actor Without Oscar',
        subtitleIT: 'Il massimo, anche senza applausi',
        subtitleEN: 'Your best, even without applause',
        descriptionIT: 'Oggi dai il massimo, anche se nessuno sta applaudendo. L\'energia c\'è, il riconoscimento può aspettare.',
        descriptionEN: 'Today you give your best, even if no one is applauding. The energy is there, recognition can wait.',
        gradientColors: ['#1a2a1a', '#2d4a2d', '#3d6b3d'],
        emoji: '🎭',
    },
};

// =============================================================================
// DETERMINISTIC ROLE SELECTION
// =============================================================================

/**
 * Determines the emotional role based on valence, arousal, and emotion percentages.
 * This is DETERMINISTIC - same input always produces the same role.
 * 
 * Role Selection Logic:
 * A) "Un Concerto Metal" - High mental load: arousal >= 0.35 AND (fear+anger high OR stress)
 * B) "Segnale infrasuono" - High sensitivity: fear dominant OR fear high with moderate/high arousal
 * C) "Motore a propulsione" - Strong drive: anger noticeable AND arousal >= 0.30
 * D) "Il Silente" - Inward/heavy: sadness dominant OR sadness high with negative valence and low arousal
 * E) "In Modalità Risparmio" - Low battery: arousal <= -0.20, valence not clearly positive
 * F) "Il Regista con il budget" - Directed agency: valence >= 0.10, arousal 0.10-0.55, not sadness/fear dominant
 * G) "L'Attore Senza Oscar" - Steady effort: mild positive valence (0.05-0.30), moderate arousal (0.05-0.35)
 * H) "L'Equilibrista" - Fallback balanced state
 */
export function determineEmotionalRole(input: EmotionInput): EmotionalRole {
    const { emotions, valence, arousal, dominant_emotion } = input;

    // Get emotion values (already 0-1 scale from API)
    const joy = emotions.joy ?? 0;
    const sadness = emotions.sadness ?? 0;
    const anger = emotions.anger ?? 0;
    const fear = emotions.fear ?? 0;
    const surprise = emotions.surprise ?? 0;
    const disgust = emotions.disgust ?? 0;
    const neutral = emotions.neutral ?? 0;

    console.log('[EmotionalHoroscope] Role determination input:', {
        dominant_emotion,
        valence,
        arousal,
        sadness,
        fear,
        anger
    });

    // A) Un Concerto Metal - High mental load
    // arousal >= 0.35 AND (fear+anger combined noticeable)
    if (arousal >= 0.35 && (fear + anger) >= 0.3) {
        return 'un_concerto_metal';
    }

    // B) Segnale infrasuono - High sensitivity (fear-driven)
    // fear is dominant OR fear is high with moderate/high arousal
    if (dominant_emotion === 'fear' || (fear >= 0.25 && arousal >= 0.2)) {
        return 'segnale_infrasuono';
    }

    // C) Motore a propulsione - Strong drive (anger-driven)
    // anger noticeable AND arousal >= 0.30
    if ((anger >= 0.2 || dominant_emotion === 'anger') && arousal >= 0.30) {
        return 'motore_a_propulsione';
    }

    // D) Il Silente - Inward/heavy (sadness-driven)
    // sadness dominant OR sadness high with valence clearly negative and arousal low-to-mid
    if (dominant_emotion === 'sadness' || (sadness >= 0.25 && valence < -0.1 && arousal <= 0.2)) {
        return 'il_silente';
    }

    // E) In Modalità Risparmio - Low battery
    // arousal <= -0.20 OR low energy with valence not clearly positive
    if (arousal <= -0.20 || (arousal <= 0 && valence <= 0.1 && neutral >= 0.3)) {
        return 'in_modalita_risparmio';
    }

    // F) Il Regista con il budget - Directed agency
    // valence >= 0.10 AND arousal between 0.10 and 0.55, not sadness/fear dominant
    if (valence >= 0.10 && arousal >= 0.10 && arousal <= 0.55 &&
        dominant_emotion !== 'sadness' && dominant_emotion !== 'fear') {
        return 'il_regista_con_il_budget';
    }

    // G) L'Attore Senza Oscar - Steady effort
    // mild positive/neutral valence (0.05..0.30) and moderate arousal (0.05..0.35)
    if (valence >= 0.05 && valence <= 0.30 && arousal >= 0.05 && arousal <= 0.35 &&
        dominant_emotion !== 'fear' && dominant_emotion !== 'sadness') {
        return 'l_attore_senza_oscar';
    }

    // H) L'Equilibrista - Fallback balanced state
    return 'l_equilibrista';
}

// =============================================================================
// OPENAI HOROSCOPE TEXT GENERATION
// =============================================================================

const HOROSCOPE_PROMPT = `
You are a playful, slightly ironic and thoughtful wellness narrator.
You generate an Emotional Horoscope: not astrology, not diagnosis, not therapy, but a playful act of introspection — a reading of the emotional “stars” written on the face.

INPUTS YOU WILL RECEIVE:
- OUTPUT_LANGUAGE: "it" or "en"
TASK:
1. Select the most appropriate ROLE for the user from the 8 available roles below.
2. Generate a short narrative text (the horoscope message) matching that role.

Return a JSON object with EXACTLY this format:
{
  "role": "role_id",
  "horoscope_text": "string"
}

ROLES AND VIBES:
- il_regista_con_il_budget: High energy, positive/neutral valence, directed action, feeling in control.
- l_equilibrista: Balanced state, harmony between feeling and doing, neutral/mild valence.
- in_modalita_risparmio: Low energy, tiredness, needing rest, low arousal.
- il_silente: Quiet, introspective, reflective, often associated with sadness or neutral state.
- un_concerto_metal: High mental load, chaos, stress, overthinking, high arousal + negative/mixed valence.
- segnale_infrasuono: High sensitivity, over-aware of surroundings, reactive, often fear-driven.
- motore_a_propulsione: Strong inner drive, intense focus, high arousal, often anger or passion-driven.
- l_attore_senza_oscar: Working hard without recognition, steady effort, determined but underappreciated.

DECISION LOGIC:
- Use EMOTION_RESULT as the biometric baseline (Valence/Arousal).
- Use JOURNAL_CONTEXT (if provided) to resolve ambiguity (e.g., is high energy 'Regista' or 'Concerto Metal'?).
- The role must be one of the 8 IDs listed above.

HARD CONSTRAINTS:
- Write strictly in OUTPUT_LANGUAGE.
- Do NOT diagnose or use clinical/medical wording.
- Do NOT claim certainty. Use soft language ("sembra", "potresti", "oggi il tuo volto suggerisce").
- Do NOT output raw numeric values.
- Keep it engaging, specific to TODAY, but short.
- NO emojis, NO bullet points.

CONFIDENCE USAGE (style only):
- If confidence < 0.55: be extra cautious, avoid strong specifics, use more "maybe/seems".
- If confidence >= 0.55: you may be more specific in describing the "vibe", still non-deterministic.

HOROSCOPE_TEXT RULES:
- 3-4 sentences. Max 340 characters (hard limit).
- Must include:
  1) a vivid description of the internal climate (today's vibe)
  2) ONE gentle micro-suggestion embedded naturally
  3) one line that reframes it positively (what this state is good for)
- Do NOT repeat the role name or description.
- Start with an engaging opening like "Oggi..." or "Today..."

ROLE CONTEXT FOR WRITING STYLE:
Match your tone to the role:
- il_regista_con_il_budget: confident, directed
- l_equilibrista: balanced, thoughtful
- in_modalita_risparmio: gentle, restful
- il_silente: contemplative, quiet
- un_concerto_metal: chaotic but accepting
- segnale_infrasuono: aware, sensitive
- motore_a_propulsione: energetic, needing focus
- l_attore_senza_oscar: determined, underappreciated

EXAMPLES (STYLE REFERENCE ONLY)
Important:
- Examples show rhythm and tone.
- Always write in OUTPUT_LANGUAGE for the actual output.
- The real output must include ONLY { "horoscope_text": "..." }.

Example 1 (ROLE: un_concerto_metal):
{
  "horoscope_text": "There’s a lot of noise today. Thoughts overlap, attention jumps, and everything asks for space at once. Not all signals deserve a response right now. Short pauses will work better than trying to keep up with every sound."
}

Example 2 (ROLE: il_silente):
{
  "horoscope_text": "Today feels quieter than it looks. You may be holding back more than you’re showing, and that’s not a problem. The day favors small releases over big decisions. Staying slightly in the background still counts as being present."
}

Example 3 (ROLE: segnale_infrasuono):
{
  "horoscope_text": "The system is highly sensitive today. You’re picking up subtle signals everywhere, which is useful but tiring. Lowering the volume a little may help. Short pauses are more compatible than long conversations right now."
}

END.
`;

export async function generateHoroscopeWithRole(
    emotionInput: EmotionInput,
    language: 'it' | 'en' = 'it',
    journalText?: string
): Promise<{ role: EmotionalRole; horoscopeText: string }> {
    try {
        const apiKey = API_CONFIG.OPENAI.API_KEY;
        if (!apiKey) {
            console.log('[EmotionalHoroscope] No API key, using fallback');
            const fbRole = determineEmotionalRole(emotionInput);
            return {
                role: fbRole,
                horoscopeText: ROLE_METADATA[fbRole][language === 'it' ? 'descriptionIT' : 'descriptionEN']
            };
        }

        const systemPrompt = HOROSCOPE_PROMPT;
        const userPrompt = JSON.stringify({
            OUTPUT_LANGUAGE: language,
            EMOTION_RESULT: {
                dominant_emotion: emotionInput.dominant_emotion,
                valence: emotionInput.valence,
                arousal: emotionInput.arousal,
                confidence: emotionInput.confidence,
            },
            JOURNAL_CONTEXT: journalText || null,
        });

        const response = await fetch(`${API_CONFIG.OPENAI.BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: API_CONFIG.OPENAI.MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: 200,
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[EmotionalHoroscope] API error:', response.status, errorData);
            const fbRole = determineEmotionalRole(emotionInput);
            return {
                role: fbRole,
                horoscopeText: ROLE_METADATA[fbRole][language === 'it' ? 'descriptionIT' : 'descriptionEN']
            };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Try to parse JSON response
        try {
            const parsed = JSON.parse(content);
            if (parsed.role && parsed.horoscope_text) {
                // Validate role
                const finalRole = ROLE_METADATA[parsed.role as EmotionalRole]
                    ? (parsed.role as EmotionalRole)
                    : determineEmotionalRole(emotionInput);

                return {
                    role: finalRole,
                    horoscopeText: parsed.horoscope_text
                };
            }
        } catch (parseError) {
            console.log('[EmotionalHoroscope] Could not parse JSON, falling back');
        }

        // Fallback to deterministic role and default description
        const fallbackRole = determineEmotionalRole(emotionInput);
        return {
            role: fallbackRole,
            horoscopeText: ROLE_METADATA[fallbackRole][language === 'it' ? 'descriptionIT' : 'descriptionEN']
        };
    } catch (error) {
        console.error('[EmotionalHoroscope] Error generating horoscope:', error);
        const fallbackRole = determineEmotionalRole(emotionInput);
        return {
            role: fallbackRole,
            horoscopeText: ROLE_METADATA[fallbackRole][language === 'it' ? 'descriptionIT' : 'descriptionEN']
        };
    }
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Generates the complete emotional horoscope for the given emotion analysis result.
 * 
 * @param emotionInput - The emotion analysis result
 * @param language - Output language ('it' or 'en') - if not provided, uses getUserLanguage()
 * @returns Complete horoscope result with role, metadata, and generated text
 */
export async function generateEmotionalHoroscope(
    emotionInput: EmotionInput,
    language?: 'it' | 'en',
    journalText?: string
): Promise<HoroscopeResult> {
    // Get language from parameter or detect from app settings
    const lang = language || await getUserLanguage();

    // Step 1 & 2: Let AI determine role and generate text simultaneously
    console.log('[EmotionalHoroscope] Requesting AI-selected role and text...');
    const { role, horoscopeText } = await generateHoroscopeWithRole(emotionInput, lang, journalText);

    console.log('[EmotionalHoroscope] AI selected role:', role);

    // Step 3: Get role metadata
    const metadata = ROLE_METADATA[role];

    return {
        role,
        metadata,
        horoscopeText,
        generatedAt: new Date(),
    };
}

// Export service as default
export default {
    determineEmotionalRole,
    generateHoroscopeWithRole,
    generateEmotionalHoroscope,
    ROLE_METADATA,
};
