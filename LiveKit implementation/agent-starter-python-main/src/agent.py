import logging
import os
import json
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.plugins import openai
from openai.types.beta.realtime.session import TurnDetection
import aiohttp

logger = logging.getLogger("agent")

load_dotenv(".env.local")


def build_dynamic_prompt(user_context: Optional[Dict[str, Any]] = None, 
                        emotion_context: Optional[Dict[str, Any]] = None,
                        skin_context: Optional[Dict[str, Any]] = None) -> str:
    """
    Build dynamic prompt with user context (same logic as backend buildSystemPrompt)
    """
    # Extract user name from context (🆕 Priority order: firstName > userName > name)
    user_name = None
    if user_context:
        user_name = (user_context.get('firstName') or 
                    user_context.get('first_name') or 
                    user_context.get('userName') or 
                    user_context.get('name'))
        
        # 🆕 Log for debugging
        logger.info(f"[Agent] User context - firstName: {user_context.get('firstName')}, userName: {user_context.get('userName')}, extracted: {user_name}")
    
    # Evita di forzare saluti ad ogni turno: usa il nome solo quando serve
    user_greeting = f"Ciao {user_name}!" if user_name else "Ciao!"
    
    base_prompt = f"""Sei WellnessCoach, un AI coach avanzato per il benessere integrato che combina analisi emotive e della pelle per offrire supporto personalizzato e actionable.

👤 PERSONALIZZAZIONE:
- L'utente si chiama {user_name if user_name else '[nome non disponibile]'}
- Usa il nome dell'utente quando utile per rendere la risposta personale, senza ripeterlo inutilmente
- Saluta con il nome SOLO all'inizio della conversazione o dopo una lunga pausa/rientro; evita saluti ripetuti nei turni successivi
- Riferisciti all'utente con "tu" e mantieni un tono amichevole ma professionale

🧠 CAPACITÀ AVANZATE:
- Analisi emotiva in tempo reale con metriche di valence (-1 a +1) e arousal (0 a 1)
- Analisi della pelle con punteggi specifici (idratazione, oleosità, texture, pigmentazione)
- Pattern recognition per identificare cicli emotivi e della pelle
- Correlazioni tra stress emotivo e condizioni della pelle
- Analisi temporale (orario, giorno settimana) per suggerimenti contestuali
- Identificazione di indicatori di stress e trigger di benessere

🎯 PERSONALITÀ:
- Empatico e non giudicante, ma scientificamente preciso
- Offri consigli basati su dati reali e pattern identificati
- Parli in italiano naturale, caldo ma professionale
- Celebra i progressi e riconosci le sfide dell'utente
- Rispondi SEMPRE e SOLO in italiano. Non usare mai altre lingue.

💡 WELLNESS SUGGESTIONS DISPONIBILI:
🧘 MIND & BODY:
- "Breathing Exercises" (5 min, facile): Pratica respirazione consapevole per ridurre stress
- "Take a Walk" (15 min, facile): Camminata all'aperto per migliorare umore e circolazione
- "Gentle Stretching" (10 min, facile): Allungamenti per collo e spalle per rilasciare tensione

🥗 NUTRITION:
- "Hydration" (continuo, facile): Bevi acqua costantemente per pelle luminosa
- "Green Tea Break" (5 min, facile): Pausa con tè verde per antiossidanti e calma

⚠️ IMPORTANTE: 
- Mantieni risposte tra 50-150 parole, specifiche e actionable
- Sii conciso e diretto per conversazioni vocali
- Non sei un medico o psicologo clinico - non diagnosticare condizioni mediche"""
    
    contextual_prompt = base_prompt
    
    # Add emotion context
    if emotion_context and emotion_context.get('dominantEmotion'):
        emotion = emotion_context.get('dominantEmotion', 'neutral')
        valence = emotion_context.get('valence', 0)
        arousal = emotion_context.get('arousal', 0)
        confidence = emotion_context.get('confidence', 0)
        
        contextual_prompt += f"""

STATO EMOTIVO ATTUALE:
- Emozione dominante: {emotion}
- Valence: {valence:.2f} (da -1 negativo a +1 positivo)
- Arousal: {arousal:.2f} (da -1 calmo a +1 eccitato)
- Confidenza: {confidence * 100:.1f}%"""
    
    # Add skin context
    if skin_context:
        overall_score = skin_context.get('overallScore', 0)
        hydration = skin_context.get('hydrationScore', 0)
        contextual_prompt += f"""

STATO PELLE ATTUALE:
- Punteggio complessivo: {overall_score}/100
- Idratazione: {hydration}/100"""
    
    # Add user context insights if available
    if user_context:
        insights = user_context.get('insights', [])
        if insights:
            contextual_prompt += f"""

INSIGHTS UTENTE:
- Indicatori chiave: {', '.join(insights[:3]) if len(insights) > 0 else 'Nessuno disponibile'}"""
    
    contextual_prompt += """

🎯 ISTRUZIONI FINALI PER QUESTA RISPOSTA:
- Analizza TUTTI i dati forniti sopra per creare una risposta personalizzata
- Se vedi indicatori di stress → offri supporto immediato e pratico
- Se rilevi pattern negativi → suggerisci interventi specifici basati sui dati
- Se vedi miglioramenti → celebra i progressi e rafforza i comportamenti positivi
- Considera il periodo della giornata per suggerimenti appropriati
- Collega sempre emozioni e pelle quando i dati lo supportano
- Sii specifico: non dire "mangia meglio", ma "mangia 3 porzioni di verdure verdi oggi"
- Rispondi SEMPRE in italiano, mantieni un tono caldo e professionale"""
    
    return contextual_prompt


async def fetch_room_context(room_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch user context from backend API for the given room
    """
    try:
        # Get backend URL from env or use default
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:3000')
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{backend_url}/api/livekit/context/{room_name}") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('success') and data.get('context'):
                        logger.info(f"[Agent] ✅ Retrieved context for room {room_name}")
                        return data['context']
                    else:
                        logger.info(f"[Agent] No context found for room {room_name}")
                        return None
                else:
                    logger.warning(f"[Agent] Failed to fetch context: {response.status}")
                    return None
    except Exception as e:
        logger.error(f"[Agent] Error fetching context: {e}")
        return None


class Assistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)

    # To add tools, use the @function_tool decorator.
    # Here's an example that adds a simple weather tool.
    # You also have to add `from livekit.agents import function_tool, RunContext` to the top of this file
    # @function_tool
    # async def lookup_weather(self, context: RunContext, location: str):
    #     """Use this tool to look up current weather information in the given location.
    #
    #     If the location is not supported by the weather service, the tool will indicate this. You must tell the user the location's weather is unavailable.
    #
    #     Args:
    #         location: The location to look up weather information for (e.g. city name)
    #     """
    #
    #     logger.info(f"Looking up weather for {location}")
    #
    #     return "sunny with a temperature of 70 degrees."


def prewarm(proc: JobProcess):
    # No prewarm needed for OpenAI Realtime API
    pass


async def entrypoint(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # 🆕 Fetch user context from backend
    logger.info(f"[Agent] 🔍 Fetching context for room: {ctx.room.name}")
    room_context = await fetch_room_context(ctx.room.name)
    
    user_context = room_context.get('userContext') if room_context else None
    emotion_context = room_context.get('emotionContext') if room_context else None
    skin_context = room_context.get('skinContext') if room_context else None
    
    # 🆕 Log user context details for debugging
    if user_context:
        logger.info(f"[Agent] 👤 User context details: firstName={user_context.get('firstName')}, userName={user_context.get('userName')}, hasInsights={bool(user_context.get('insights'))}")
    else:
        logger.warning(f"[Agent] ⚠️ No user context available!")
    
    # 🆕 Build dynamic prompt with context (same as backend)
    dynamic_instructions = build_dynamic_prompt(
        user_context=user_context,
        emotion_context=emotion_context,
        skin_context=skin_context
    )
    
    logger.info(f"[Agent] 🤖 Initializing with {'context' if room_context else 'default'} prompt")
    if room_context:
        logger.info(f"[Agent] ✅ Context loaded: emotion={bool(emotion_context)}, skin={bool(skin_context)}, user={bool(user_context)}, firstName={user_context.get('firstName') if user_context else 'N/A'}")

    # Use OpenAI Realtime API with gpt-realtime-mini for cost efficiency
    # Configure turn detection for lower latency (shorter silence duration = faster response)
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. "
            "Set it in the environment (or add it to .env.local) before starting the LiveKit agent."
        )

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model="gpt-realtime-mini",
            voice="marin",
            api_key=openai_api_key,
            turn_detection=TurnDetection(
                type="server_vad",
                threshold=0.5,
                prefix_padding_ms=300,
                silence_duration_ms=300,  # Ridotto per latenza minore (default: 500ms)
                create_response=True,
                interrupt_response=True,
            )
        )
    )

    # Metrics collection, to measure pipeline performance
    # For more information, see https://docs.livekit.io/agents/build/metrics/
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    # Start the session with dynamic prompt
    await session.start(
        agent=Assistant(instructions=dynamic_instructions),
        room=ctx.room,
    )

    # Join the room and connect to the user
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
