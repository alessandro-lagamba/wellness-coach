import { useState, useEffect, useCallback } from 'react';
import DailyCopilotService, { DailyCopilotData } from '../services/daily-copilot.service';

export const useDailyCopilot = () => {
  const [copilotData, setCopilotData] = useState<DailyCopilotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const copilotService = DailyCopilotService.getInstance();

  const loadCopilotData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      if (forceRefresh) {
        copilotService.invalidateCache();
      }
      
      const data = await copilotService.generateDailyCopilotAnalysis();
      if (data) {
        setCopilotData(data);
        setLastUpdated(new Date());
      } else {
        setError('Impossibile generare l\'analisi del copilot');
      }
    } catch (err) {
      setError('Errore nel caricamento dei dati');
      console.error('Error loading copilot data:', err);
    } finally {
      setLoading(false);
    }
  }, [copilotService]);

  const refreshCopilotData = useCallback(() => {
    return loadCopilotData(true);
  }, [loadCopilotData]);

  // Carica i dati al mount
  useEffect(() => {
    loadCopilotData();
  }, [loadCopilotData]);

  // Auto-refresh ogni 30 minuti se l'app è attiva
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        loadCopilotData();
      }
    }, 30 * 60 * 1000); // 30 minuti

    return () => clearInterval(interval);
  }, [loadCopilotData, loading]);

  return {
    copilotData,
    loading,
    error,
    lastUpdated,
    refreshCopilotData,
    loadCopilotData,
  };
};

