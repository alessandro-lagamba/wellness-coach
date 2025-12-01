import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { HealthDataStatus } from '../types/health.types';

/** ================= Types ================= */
export type WidgetSize = 'small' | 'medium' | 'large'; // 1/3, 2/3, 3/3 (della row)

export interface WidgetConfig {
  id: string;
  enabled: boolean;
  size: WidgetSize;
  /** Posizione nella griglia 2x3 -> 0..5  (0-1-2 riga1, 3-4-5 riga2) */
  position: number;
}

export interface WidgetData {
  id: string;
  title: string;
  icon: string;
  color: string;
  backgroundColor: string;
  category: 'health' | 'wellness' | 'analysis';
  // Dati opzionali per widget specifici
  steps?: { current: number; goal: number; km: number; calories: number };
  hydration?: { 
    glasses: number; // 🔥 FIX: Ora contiene il valore in unità preferita (non sempre bicchieri)
    goal: number; // 🔥 FIX: Goal in unità preferita
    ml: number; 
    lastDrink: string;
    preferredUnit?: 'glass' | 'bottle' | 'liter'; // 🆕 Unità preferita
    unitLabel?: string; // 🆕 Etichetta unità (es. "bicchiere", "bottiglia", "litro")
  };
  meditation?: { minutes: number; goal: number; sessions: number; streak: number; favoriteType: string };
  sleep?: { hours: number; quality: number; goal: number; deepSleep: string; remSleep: string; bedtime: string; wakeTime: string };
  hrv?: { value: number; restingHR: number; currentHR?: number; avgHRV: number; recovery: string };
  analyses?: { completed: boolean; emotionAnalysis: boolean; skinAnalysis: boolean; lastCheckIn: string; streak: number };
  cycle?: { day: number; phase: string; phaseName: string; nextPeriodDays: number; cycleLength: number };
  placeholder?: {
    status: HealthDataStatus;
    message: string;
  };
}

/** ============== Singleton Service ============== */
class WidgetConfigService {
  private static instance: WidgetConfigService;

  private readonly STORAGE_KEY = 'widgetConfig';

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

  // Config di default (2 righe, 3 colonne)
  private defaultConfig: WidgetConfig[] = [
    { id: 'steps',       enabled: true, size: 'small',  position: 0 },
    { id: 'meditation',  enabled: true, size: 'medium', position: 1 },
    { id: 'hydration',   enabled: true, size: 'small',  position: 2 },
    { id: 'sleep',       enabled: true, size: 'large',  position: 3 },
    { id: 'hrv',         enabled: true, size: 'small',  position: 4 },
    { id: 'cycle',       enabled: false, size: 'small', position: 0 }, // Disabilitato di default, può essere abilitato
  ];

  static getInstance(): WidgetConfigService {
    if (!WidgetConfigService.instance) {
      WidgetConfigService.instance = new WidgetConfigService();
    }
    return WidgetConfigService.instance;
  }

  /** -------- Helpers griglia 2x3 -------- */
  isValidPosition = (pos: number) => pos >= 0 && pos <= 5;
  toPos = (row: number, col: number) => row * 3 + col;
  fromPos = (pos: number) => ({ row: Math.floor(pos / 3), col: pos % 3 });

  /** -------- Larghezza per size -------- */
  getSizeWidth(size: WidgetSize): number {
    switch (size) {
      case 'small': return 1;   // 1/3
      case 'medium': return 2;  // 2/3
      case 'large': return 3;   // 3/3
      default: return 1;
    }
  }

  /** -------- Persistence -------- */
  async getWidgetConfig(): Promise<WidgetConfig[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      const parsed: WidgetConfig[] | null = stored ? JSON.parse(stored) : null;
      return parsed?.length ? parsed : this.defaultConfig;
    } catch {
      return this.defaultConfig;
    }
  }

  private async save(config: WidgetConfig[]) {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    // 🔔 Notifica tutti gli ascoltatori (tutte le istanze di useWidgetConfig)
    this.notifyAll();
  }

  /** -------- Occupazione slot (per evitare "trattini" vuoti) --------
   * Ritorna il set di posizioni effettivamente occupate dagli widget attivi,
   * espandendo la loro larghezza (es. large a pos 3 occupa 3,4,5).
   */
  getOccupiedPositions(cfg: WidgetConfig[]): Set<number> {
    const occ = new Set<number>();
    for (const w of cfg) {
      if (!w.enabled) continue;
      const row = Math.floor(w.position / 3);
      const col = w.position % 3;
      const span = this.getSizeWidth(w.size);
      for (let i = 0; i < span; i++) {
        const c = col + i;
        if (c <= 2) {
          occ.add(row * 3 + c);
        }
      }
    }
    return occ;
  }

  /** True se lo slot è utilizzabile (non occupato né “coperto” da uno span) */
  isSlotUsable(cfg: WidgetConfig[], pos: number): boolean {
    if (!this.isValidPosition(pos)) return false;
    const occupied = this.getOccupiedPositions(cfg);
    return !occupied.has(pos);
  }

  /** -------- Mutations -------- */
  async updateWidgetConfig(widgetId: string, updates: Partial<WidgetConfig>) {
    const cfg = await this.getWidgetConfig();
    const i = cfg.findIndex(w => w.id === widgetId);
    if (i === -1) return;
    cfg[i] = { ...cfg[i], ...updates };
    await this.save(cfg);
  }

  async toggleWidget(widgetId: string) {
    const cfg = await this.getWidgetConfig();
    const w = cfg.find(x => x.id === widgetId);
    if (!w) return;
    // NB: toggle “puro” (non forza la size). Per riabilitare con size 'small'
    // usa enableWidget(...) o addWidget(...).
    w.enabled = !w.enabled;
    await this.save(cfg);
  }

  /** Abilita esplicitamente un widget, forzando la size (default 'small') e pos opzionale */
  async enableWidget(widgetId: string, size: WidgetSize = 'small', preferredPos?: number) {
    const cfg = await this.getWidgetConfig();
    const w = cfg.find(x => x.id === widgetId);
    if (!w) return;
    w.enabled = true;
    w.size = size; // forza sempre la small di default
    if (this.isValidPosition(preferredPos ?? -1)) {
      w.position = preferredPos as number;
    }
    await this.save(cfg);
  }

  async changeWidgetSize(widgetId: string, size: WidgetSize) {
    console.log('🔄 CHANGING WIDGET SIZE:', { widgetId, newSize: size });
    const cfg = await this.getWidgetConfig();
    const widget = cfg.find(w => w.id === widgetId);
    if (!widget) return;

    const oldSize = widget.size;
    const row = Math.floor(widget.position / 3);
    
    // 🔥 FIX: Simula la configurazione finale dopo il cambio e la gestione dei conflitti
    const testCfg = cfg.map(w => ({ ...w }));
    const testWidget = testCfg.find(w => w.id === widgetId)!;
    testWidget.size = size;
    
    // Simula handleSizeConflict per vedere quali widget verrebbero disabilitati
    const newWidth = this.getSizeWidth(size);
    const col = widget.position % 3;
    const widgetsInRow = testCfg.filter(w =>
      w.enabled &&
      Math.floor(w.position / 3) === row &&
      w.id !== widgetId
    );
    
    if (newWidth === 3) {
      // Il large copre tutta la riga, disabilita tutti gli altri widget nella riga
      widgetsInRow.forEach(w => { w.enabled = false; });
    } else if (newWidth === 2) {
      const startCol = col;
      const endCol = startCol + 1;
      widgetsInRow.forEach(w => {
        const wCol = w.position % 3;
        if (wCol >= startCol && wCol <= endCol) {
          w.enabled = false;
        }
      });
    }
    
    // 🔥 FIX: Valida che la configurazione finale sia valida
    if (!this.isValidRowLayout(testCfg, widgetId, size, row)) {
      console.warn('⚠️ Invalid widget layout: cannot have 2 medium widgets or other invalid combinations');
      return; // Non applicare il cambio se la combinazione finale non è valida
    }

    // Applica il cambio
    widget.size = size;

    if (this.getSizeWidth(size) > this.getSizeWidth(oldSize)) {
      console.log('🔄 Widget enlarged, checking for conflicts...');
      await this.handleSizeConflict(cfg, widget);
    }

    await this.save(cfg);
  }

  /** 🔥 FIX: Valida che la combinazione di widget in una riga sia valida
   * Regole:
   * - Massimo 3 slot per riga
   * - 1 widget L = 3 slot ✅
   * - 1 widget M + 1 widget S = 2 + 1 = 3 slot ✅
   * - 3 widget S = 1 + 1 + 1 = 3 slot ✅
   * - NON valido: 2 widget M = 2 + 2 = 4 slot ❌
   */
  private isValidRowLayout(cfg: WidgetConfig[], widgetId: string, newSize: WidgetSize, row: number): boolean {
    // Simula la configurazione con il nuovo size
    const widgetsInRow = cfg
      .filter(w => w.enabled && Math.floor(w.position / 3) === row)
      .map(w => ({
        ...w,
        size: w.id === widgetId ? newSize : w.size
      }));

    // Calcola la larghezza totale occupata nella riga
    let totalWidth = 0;
    for (const w of widgetsInRow) {
      totalWidth += this.getSizeWidth(w.size);
    }

    // La larghezza totale non deve superare 3
    if (totalWidth > 3) {
      return false;
    }

    // Controlla che non ci siano 2 widget M insieme
    const mediumWidgets = widgetsInRow.filter(w => w.size === 'medium');
    if (mediumWidgets.length > 1) {
      return false;
    }

    // Se c'è un widget L, non ci devono essere altri widget nella riga
    const largeWidgets = widgetsInRow.filter(w => w.size === 'large');
    if (largeWidgets.length > 0 && widgetsInRow.length > 1) {
      return false;
    }

    return true;
  }

  // Gestisce i conflitti quando un widget viene allargato
  private async handleSizeConflict(cfg: WidgetConfig[], enlargedWidget: WidgetConfig) {
    const row = Math.floor(enlargedWidget.position / 3);
    const col = enlargedWidget.position % 3;
    const newWidth = this.getSizeWidth(enlargedWidget.size);

    const widgetsInRow = cfg.filter(w =>
      w.enabled &&
      Math.floor(w.position / 3) === row &&
      w.id !== enlargedWidget.id
    );

    const widgetsToDisable: string[] = [];
    if (newWidth === 3) {
      // il large copre tutta la riga
      widgetsToDisable.push(...widgetsInRow.map(w => w.id));
    } else if (newWidth === 2) {
      const startCol = col;
      const endCol = startCol + 1;
      widgetsInRow.forEach(w => {
        const wCol = w.position % 3;
        if (wCol >= startCol && wCol <= endCol) widgetsToDisable.push(w.id);
      });
    }

    if (widgetsToDisable.length) {
      widgetsToDisable.forEach(id => {
        const w = cfg.find(x => x.id === id);
        if (w) w.enabled = false;
      });
    }
  }

  async reorderWidgets(newOrder: WidgetConfig[]) {
    await this.save(newOrder);
  }

  async swapPositions(aId: string, bId: string) {
    const cfg = await this.getWidgetConfig();
    const a = cfg.find(w => w.id === aId);
    const b = cfg.find(w => w.id === bId);
    if (!a || !b) return;
    const tmp = a.position;
    a.position = b.position;
    b.position = tmp;
    await this.save(cfg);
  }

  async moveToPosition(widgetId: string, newPos: number) {
    if (!this.isValidPosition(newPos)) return;
    const cfg = await this.getWidgetConfig();
    const me = cfg.find(w => w.id === widgetId);
    if (!me) return;

    const other = cfg.find(w => w.enabled && w.id !== widgetId && w.position === newPos);
    if (other) {
      const old = me.position;
      me.position = newPos;
      other.position = old;
    } else {
      me.position = newPos;
    }
    await this.save(cfg);
  }

  async removeWidget(widgetId: string) {
    await this.updateWidgetConfig(widgetId, { enabled: false });
  }

  /** Aggiunge/abilita un widget con size di default = 'small'
   *  NB: se già esiste in config, lo ri-abilita e forza la size passata.
   */
  async addWidget(widgetId: string, size: WidgetSize = 'small', preferredPos?: number) {
    const cfg = await this.getWidgetConfig();
    const exists = cfg.find(w => w.id === widgetId);
    if (exists) {
      exists.enabled = true;
      // 👉 forza sempre la size alla richiesta (default 'small')
      exists.size = size;
      if (this.isValidPosition(preferredPos ?? -1)) exists.position = preferredPos as number;
      
      // 🔥 FIX: Valida che la combinazione di widget nella riga sia valida
      const row = Math.floor((preferredPos ?? exists.position) / 3);
      if (!this.isValidRowLayout(cfg, widgetId, size, row)) {
        console.warn('⚠️ Invalid widget layout: cannot add widget with this size');
        // Fallback: prova a trovare una posizione valida nella stessa riga o in un'altra
        const used = new Set(this.getOccupiedPositions(cfg));
        for (let p = 0; p < 6; p++) {
          if (!used.has(p)) {
            const testRow = Math.floor(p / 3);
            if (this.isValidRowLayout(cfg, widgetId, size, testRow)) {
              exists.position = p;
              break;
            }
          }
        }
      }
      
      await this.save(cfg);
      return;
    }
    // nuovo
    let pos = 0;
    const used = new Set(this.getOccupiedPositions(cfg)); // usa pos occupate reali
    for (let p = 0; p < 6; p++) {
      if (!used.has(p)) {
        const testRow = Math.floor(p / 3);
        // 🔥 FIX: Verifica che la combinazione sia valida prima di assegnare la posizione
        if (this.isValidRowLayout(cfg, widgetId, size, testRow)) {
          pos = p;
          break;
        }
      }
    }
    cfg.push({ id: widgetId, enabled: true, size, position: preferredPos ?? pos });
    await this.save(cfg);
  }
}

export const widgetConfigService = WidgetConfigService.getInstance();

/** ============== Hook stateful per la UI ============== */
export const useWidgetConfig = () => {
  const [config, setConfig] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const cfg = await widgetConfigService.getWidgetConfig();
    console.log('🔄 HOOK LOADING CONFIG:', cfg.map(w => ({ id: w.id, position: w.position, enabled: w.enabled, size: w.size })));
    setConfig(cfg);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // 👇 ascolta le modifiche provenienti da QUALSIASI componente
    const unsub = widgetConfigService.subscribe(() => {
      // ricarica quando qualcuno salva
      load();
    });
    return unsub;
  }, []);

  // Helpers derivati in hook (comodi in UI)
  const isSlotUsable = (pos: number) => widgetConfigService.isSlotUsable(config, pos);

  const updateConfig    = async (id: string, updates: Partial<WidgetConfig>) => widgetConfigService.updateWidgetConfig(id, updates);
  const toggleWidget    = async (id: string) => widgetConfigService.toggleWidget(id);
  const changeSize      = async (id: string, size: WidgetSize) => widgetConfigService.changeWidgetSize(id, size);
  const reorderWidgets  = async (order: WidgetConfig[]) => widgetConfigService.reorderWidgets(order);
  const moveToPosition  = async (id: string, pos: number) => widgetConfigService.moveToPosition(id, pos);
  const swapPositions   = async (aId: string, bId: string) => widgetConfigService.swapPositions(aId, bId);
  const addWidget       = async (id: string, size: WidgetSize = 'small', pos?: number) => widgetConfigService.addWidget(id, size, pos);
  const enableWidget    = async (id: string, size: WidgetSize = 'small', pos?: number) => widgetConfigService.enableWidget(id, size, pos); // opzionale
  const removeWidget    = async (id: string) => widgetConfigService.removeWidget(id);

  // set "memo" di posizioni occupate se mai ti servisse in UI (non obbligatorio)
  const occupiedPositions = useMemo(() => widgetConfigService.getOccupiedPositions(config), [config]);

  return { 
    config, 
    loading, 
    reload: load,
    // helpers di layout
    isSlotUsable, 
    occupiedPositions,
    // mutations
    updateConfig, toggleWidget, changeSize, reorderWidgets, moveToPosition,
    swapPositions, addWidget, enableWidget, removeWidget 
  };
};

/** ============== Mock generator (dati demo) ============== */
export class WidgetDataService {
  static generateWidgetData(goals?: {
    steps?: number;
    hydration?: number;
    meditation?: number;
    sleep?: number;
  }): WidgetData[] {
    // mock dei valori correnti (solo per la demo)
    const mock = {
      steps: 6777, hydration: 3, mindfulness: 7,
      sleepHours: 7.5, sleepQuality: 82, hrv: 35, restingHR: 66, analysesCompleted: 2
    };

    const stepsGoal = goals?.steps ?? 10000;
    const hydrationGoal = goals?.hydration ?? 8;
    const meditationGoal = goals?.meditation ?? 30;
    const sleepGoal = goals?.sleep ?? 8;

    return [
      { id: 'steps', title: 'Steps', icon: '🚶', color: '#10b981', backgroundColor: '#f0fdf4', category: 'health',
        steps: { current: mock.steps, goal: stepsGoal, km: Math.round(mock.steps * 0.0008 * 100) / 100, calories: Math.round(mock.steps * 0.04) } },
      { id: 'meditation', title: 'Meditation', icon: '🧘', color: '#8b5cf6', backgroundColor: '#f3f4f6', category: 'wellness',
        meditation: { minutes: mock.mindfulness, goal: meditationGoal, sessions: 2, streak: 5, favoriteType: 'Breathing' } },
      { id: 'hydration', title: 'Hydration', icon: '💧', color: '#3b82f6', backgroundColor: '#eff6ff', category: 'health',
        hydration: { glasses: mock.hydration, goal: hydrationGoal, ml: mock.hydration * 250, lastDrink: '2h ago' } },
      { id: 'sleep', title: 'Sleep', icon: '🌙', color: '#6366f1', backgroundColor: '#eef2ff', category: 'health',
        sleep: { hours: mock.sleepHours, quality: mock.sleepQuality, goal: sleepGoal, deepSleep: '2h 15m', remSleep: '1h 45m', bedtime: '11:30 PM', wakeTime: '7:30 AM' } },
      { id: 'hrv', title: 'HRV', icon: '🫀', color: '#ef4444', backgroundColor: '#fef2f2', category: 'health',
        hrv: { value: mock.hrv, restingHR: mock.restingHR, currentHR: 72, avgHRV: 35, recovery: 'Good' } },
      { id: 'cycle', title: 'Cycle', icon: '🌸', color: '#ec4899', backgroundColor: '#fdf2f8', category: 'health',
        cycle: { day: 5, phase: 'menstrual', phaseName: 'Menstrual', nextPeriodDays: 24, cycleLength: 28 } },
    ];
  }
}
