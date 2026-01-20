import { useState, useEffect, useCallback } from 'react';
import DailyCopilotService, { DailyCopilotData } from '../services/daily-copilot.service';

export const useDailyCopilot = () => {
  const [copilotData, setCopilotData] = useState<DailyCopilotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const copilotService = DailyCopilotService.getInstance();

  const loadCopilotData = useCallback(async () => {
    let timeoutId: any;

    try {
      setLoading(true);
      setError(null);

      timeoutId = setTimeout(() => {
        console.warn('⚠️ Daily Copilot: forced timeout after 15s');
        // Force stop loading regardless of current state capture
        setLoading(false);
      }, 15000);

      // 🔥 Il servizio controlla automaticamente se esiste già un'analisi per oggi nel database
      // Se esiste, la ritorna senza rigenerarla. Se non esiste, genera una nuova analisi.
      const data = await copilotService.generateDailyCopilotAnalysis();

      clearTimeout(timeoutId);

      if (data) {
        setCopilotData(data);
        setLastUpdated(new Date());
      } else {
        // ✅ FIX: Usa la traduzione invece di testo hardcoded
        setError(null); // Non impostare errore, mostra empty state
      }
    } catch (err) {
      clearTimeout(timeoutId!);
      setError('Errore nel caricamento dei dati');
      console.error('Error loading copilot data:', err);
    } finally {
      // Assicura che loading sia false alla fine
      setLoading(false);
    }
  }, [copilotService]);

  // 🔥 Carica i dati solo al mount - una volta al giorno
  // Il servizio controlla automaticamente se esiste già un'analisi per oggi
  useEffect(() => {
    loadCopilotData();
  }, [loadCopilotData]);

  return {
    copilotData,
    loading,
    error,
    lastUpdated,
    reload: loadCopilotData,
  };
};

