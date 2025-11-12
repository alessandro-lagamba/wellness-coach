import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useMemo } from 'react';

/** ================= Types ================= */
export type ChartType = 'steps' | 'sleepHours' | 'hrv' | 'heartRate' | 'hydration' | 'meditation';

export interface ChartConfig {
  id: ChartType;
  enabled: boolean;
  /** Posizione nell'ordine di visualizzazione (0, 1, 2, 3, 4, 5) */
  position: number;
}

/** ============== Singleton Service ============== */
class ChartConfigService {
  private static instance: ChartConfigService;

  private readonly STORAGE_KEY = 'chartConfig';

  // ---- Pub/Sub per notificare tutti i componenti quando cambia la config
  private subscribers = new Set<() => void>();
  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }
  private notifyAll() {
    for (const cb of Array.from(this.subscribers)) {
      try { cb(); } catch {}
    }
  }

  // Config di default (solo alcuni abilitati di default)
  private defaultConfig: ChartConfig[] = [
    { id: 'steps', enabled: true, position: 0 },
    { id: 'sleepHours', enabled: true, position: 1 },
    { id: 'hrv', enabled: true, position: 2 },
    { id: 'heartRate', enabled: true, position: 3 },
    { id: 'hydration', enabled: false, position: 4 },
    { id: 'meditation', enabled: false, position: 5 },
  ];

  static getInstance(): ChartConfigService {
    if (!ChartConfigService.instance) {
      ChartConfigService.instance = new ChartConfigService();
    }
    return ChartConfigService.instance;
  }

  /** -------- Persistence -------- */
  async getChartConfig(): Promise<ChartConfig[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const parsed: ChartConfig[] | null = stored ? JSON.parse(stored) : null;
      return parsed?.length ? parsed : this.defaultConfig;
    } catch {
      return this.defaultConfig;
    }
  }

  private async save(config: ChartConfig[]) {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    // 🔔 Notifica tutti gli ascoltatori
    this.notifyAll();
  }

  /** -------- Mutations -------- */
  async toggleChart(chartId: ChartType) {
    const cfg = await this.getChartConfig();
    const chart = cfg.find(x => x.id === chartId);
    if (!chart) return;
    chart.enabled = !chart.enabled;
    await this.save(cfg);
  }

  async updateChartConfig(chartId: ChartType, updates: Partial<ChartConfig>) {
    const cfg = await this.getChartConfig();
    const i = cfg.findIndex(c => c.id === chartId);
    if (i === -1) return;
    cfg[i] = { ...cfg[i], ...updates };
    await this.save(cfg);
  }

  async reorderCharts(newOrder: ChartConfig[]) {
    // Riassegna le posizioni in base all'ordine
    const reordered = newOrder.map((chart, index) => ({
      ...chart,
      position: index,
    }));
    await this.save(reordered);
  }

  async swapPositions(aId: ChartType, bId: ChartType) {
    const cfg = await this.getChartConfig();
    const a = cfg.find(c => c.id === aId);
    const b = cfg.find(c => c.id === bId);
    if (!a || !b) return;
    const tmp = a.position;
    a.position = b.position;
    b.position = tmp;
    await this.save(cfg);
  }

  async moveToPosition(chartId: ChartType, newPos: number) {
    if (newPos < 0 || newPos > 5) return;
    const cfg = await this.getChartConfig();
    const me = cfg.find(c => c.id === chartId);
    if (!me) return;

    const other = cfg.find(c => c.enabled && c.id !== chartId && c.position === newPos);
    if (other) {
      const old = me.position;
      me.position = newPos;
      other.position = old;
    } else {
      me.position = newPos;
    }
    await this.save(cfg);
  }

  async enableChart(chartId: ChartType, preferredPos?: number) {
    const cfg = await this.getChartConfig();
    const chart = cfg.find(c => c.id === chartId);
    if (!chart) return;
    chart.enabled = true;
    if (preferredPos !== undefined && preferredPos >= 0 && preferredPos <= 5) {
      chart.position = preferredPos;
    } else {
      // Se non specificata, assegna la posizione più alta disponibile
      const maxPos = Math.max(...cfg.filter(c => c.enabled && c.id !== chartId).map(c => c.position), -1);
      chart.position = maxPos + 1;
    }
    await this.save(cfg);
  }
  
  /** Ottiene tutti i grafici disponibili (abilitati e disabilitati) */
  async getAllCharts(): Promise<ChartConfig[]> {
    return this.getChartConfig();
  }
  
  /** Ottiene solo i grafici disponibili ma non ancora abilitati */
  async getAvailableCharts(): Promise<ChartType[]> {
    const cfg = await this.getChartConfig();
    return cfg.filter(c => !c.enabled).map(c => c.id);
  }

  async disableChart(chartId: ChartType) {
    await this.updateChartConfig(chartId, { enabled: false });
  }
}

export const chartConfigService = ChartConfigService.getInstance();

/** ============== Hook stateful per la UI ============== */
export const useChartConfig = () => {
  const [config, setConfig] = useState<ChartConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const cfg = await chartConfigService.getChartConfig();
    setConfig(cfg);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // 👇 ascolta le modifiche provenienti da QUALSIASI componente
    const unsub = chartConfigService.subscribe(() => {
      // ricarica quando qualcuno salva
      load();
    });
    return unsub;
  }, []);

  // Helpers derivati in hook
  const enabledCharts = useMemo(() => 
    config.filter(c => c.enabled).sort((a, b) => a.position - b.position),
    [config]
  );

  const updateConfig = async (id: ChartType, updates: Partial<ChartConfig>) => 
    chartConfigService.updateChartConfig(id, updates);
  const toggleChart = async (id: ChartType) => 
    chartConfigService.toggleChart(id);
  const reorderCharts = async (order: ChartConfig[]) => 
    chartConfigService.reorderCharts(order);
  const moveToPosition = async (id: ChartType, pos: number) => 
    chartConfigService.moveToPosition(id, pos);
  const swapPositions = async (aId: ChartType, bId: ChartType) => 
    chartConfigService.swapPositions(aId, bId);
  const enableChart = async (id: ChartType, pos?: number) => 
    chartConfigService.enableChart(id, pos);
  const disableChart = async (id: ChartType) => 
    chartConfigService.disableChart(id);
  const getAvailableCharts = async () => 
    chartConfigService.getAvailableCharts();

  return { 
    config, 
    loading, 
    enabledCharts,
    reload: load,
    // mutations
    updateConfig, toggleChart, reorderCharts, moveToPosition,
    swapPositions, enableChart, disableChart,
    // queries
    getAvailableCharts,
  };
};

