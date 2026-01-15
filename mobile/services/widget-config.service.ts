import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { HealthDataStatus } from '../types/health.types';
import { CycleData } from './menstrual-cycle.service';

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
  cycle?: CycleData;
  calories?: { current: number; goal: number; carbs: number; protein: number; fat: number };
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
      try { cb(); } catch { }
    }
  }

  // Config di default (2 righe, 3 colonne)
  // 🔥 FIX: Ogni widget ha una posizione unica. 'cycle' usa -1 (non posizionato) quando disabilitato.
  private defaultConfig: WidgetConfig[] = [
    { id: 'steps', enabled: true, size: 'small', position: 0 },
    { id: 'meditation', enabled: true, size: 'small', position: 1 },
    { id: 'hydration', enabled: true, size: 'small', position: 2 },
    { id: 'sleep', enabled: true, size: 'small', position: 3 },
    { id: 'hrv', enabled: true, size: 'small', position: 4 },
    { id: 'calories', enabled: true, size: 'small', position: 5 },
    { id: 'cycle', enabled: false, size: 'small', position: -1 }, // -1 = non posizionato (verrà assegnato quando abilitato)
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

      if (!parsed || parsed.length === 0) {
        return this.defaultConfig;
      }

      // Merge with default config to ensure new widgets appear
      const currentIds = new Set(parsed.map(w => w.id));
      const missingWidgets = this.defaultConfig.filter(w => !currentIds.has(w.id));

      if (missingWidgets.length > 0) {
        const merged = [...parsed, ...missingWidgets];
        // Save the merged config so it persists and UI updates
        await this.save(merged);
        return merged;
      }

      return parsed;
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

    // 🔥 FIX: When disabling, set position to -1. When enabling, find a valid position.
    if (w.enabled) {
      // Disabling: set position to -1
      w.enabled = false;
      w.position = -1;
    } else {
      // Enabling: find first available position
      w.enabled = true;
      const used = new Set(this.getOccupiedPositions(cfg.filter(x => x.id !== widgetId)));
      for (let p = 0; p < 6; p++) {
        if (!used.has(p)) {
          const testRow = Math.floor(p / 3);
          if (this.isValidRowLayout(cfg, widgetId, w.size, testRow)) {
            w.position = p;
            break;
          }
        }
      }
    }
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
    const col = widget.position % 3;
    const newWidth = this.getSizeWidth(size);

    // 🔥 FIX: Verifica che il widget possa stare nella posizione corrente con la nuova size
    // Se la nuova larghezza farebbe uscire il widget dalla riga corrente, spostiamolo all'inizio della riga
    if (col + newWidth > 3) {
      // Il widget non può stare nella posizione corrente, spostiamolo all'inizio della riga
      widget.position = row * 3;
    }

    // Applica il cambio di size
    widget.size = size;

    // 🔥 FIX: Se la size è aumentata, gestisci i conflitti (sposta i widget in conflitto)
    if (this.getSizeWidth(size) > this.getSizeWidth(oldSize)) {
      console.log('🔄 Widget enlarged, shifting conflicting widgets...');
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
  // 🔥 FIX: Sposta i widget in conflitto invece di disabilitarli
  private async handleSizeConflict(cfg: WidgetConfig[], enlargedWidget: WidgetConfig) {
    const row = Math.floor(enlargedWidget.position / 3);
    const col = enlargedWidget.position % 3;
    const newWidth = this.getSizeWidth(enlargedWidget.size);

    const widgetsInRow = cfg.filter(w =>
      w.enabled &&
      Math.floor(w.position / 3) === row &&
      w.id !== enlargedWidget.id
    );

    const widgetsToMove: WidgetConfig[] = [];
    if (newWidth === 3) {
      // il large copre tutta la riga - sposta tutti gli altri widget
      widgetsToMove.push(...widgetsInRow);
    } else if (newWidth === 2) {
      const startCol = col;
      const endCol = startCol + 1;
      widgetsInRow.forEach(w => {
        const wCol = w.position % 3;
        if (wCol >= startCol && wCol <= endCol) {
          widgetsToMove.push(w);
        }
      });
    }

    if (widgetsToMove.length > 0) {
      // 🔥 FIX: Trova le posizioni disponibili nelle righe successive e sposta i widget lì
      // Ordina i widget da spostare per posizione per mantenere l'ordine relativo
      widgetsToMove.sort((a, b) => a.position - b.position);

      // Trova tutte le posizioni occupate
      const occupiedPositions = new Set(
        cfg.filter(w => w.enabled && !widgetsToMove.includes(w))
          .flatMap(w => {
            const positions = [];
            const startPos = w.position;
            const width = this.getSizeWidth(w.size);
            for (let i = 0; i < width; i++) {
              positions.push(startPos + i);
            }
            return positions;
          })
      );

      // Aggiungi le posizioni occupate dal widget ingrandito
      for (let i = 0; i < newWidth; i++) {
        occupiedPositions.add(enlargedWidget.position + i);
      }

      // Sposta ogni widget alla prima posizione disponibile
      let nextAvailablePos = (row + 1) * 3; // Inizia dalla prossima riga

      for (const widgetToMove of widgetsToMove) {
        const widgetWidth = this.getSizeWidth(widgetToMove.size);

        // Trova una posizione valida che:
        // 1. Non sia occupata
        // 2. Abbia spazio sufficiente per la larghezza del widget
        // 3. Non tagli una riga (widget medium/large devono stare nella stessa riga)
        while (true) {
          const rowOfPos = Math.floor(nextAvailablePos / 3);
          const colOfPos = nextAvailablePos % 3;

          // Verifica se il widget può stare in questa posizione senza tagliare la riga
          if (colOfPos + widgetWidth > 3) {
            // Non c'è spazio in questa riga, passa alla prossima
            nextAvailablePos = (rowOfPos + 1) * 3;
            continue;
          }

          // Verifica se le posizioni necessarie sono libere
          let allPositionsFree = true;
          for (let i = 0; i < widgetWidth; i++) {
            if (occupiedPositions.has(nextAvailablePos + i)) {
              allPositionsFree = false;
              break;
            }
          }

          if (allPositionsFree) {
            // Assegna la nuova posizione
            widgetToMove.position = nextAvailablePos;

            // Marca le nuove posizioni come occupate
            for (let i = 0; i < widgetWidth; i++) {
              occupiedPositions.add(nextAvailablePos + i);
            }

            nextAvailablePos += widgetWidth;
            break;
          } else {
            nextAvailablePos++;
          }
        }
      }
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
    // 🔥 FIX: Set position to -1 when disabling, so empty slots appear correctly
    await this.updateWidgetConfig(widgetId, { enabled: false, position: -1 });
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

      // 🔥 FIX: Se il widget ha posizione -1 o non valida, trova uno slot valido
      const currentPos = exists.position;
      const targetPos = this.isValidPosition(preferredPos ?? -1) ? preferredPos! : currentPos;

      if (!this.isValidPosition(targetPos) || targetPos < 0) {
        // Trova il primo slot libero
        const used = new Set(this.getOccupiedPositions(cfg.filter(w => w.id !== widgetId)));
        for (let p = 0; p < 6; p++) {
          if (!used.has(p)) {
            const testRow = Math.floor(p / 3);
            if (this.isValidRowLayout(cfg, widgetId, size, testRow)) {
              exists.position = p;
              console.log(`✅ Widget ${widgetId} assigned to position ${p}`);
              break;
            }
          }
        }
      } else {
        exists.position = targetPos;
        // 🔥 FIX: Valida che la combinazione di widget nella riga sia valida
        const row = Math.floor(targetPos / 3);
        if (!this.isValidRowLayout(cfg, widgetId, size, row)) {
          console.warn('⚠️ Invalid widget layout: cannot add widget with this size');
          // Fallback: prova a trovare una posizione valida nella stessa riga o in un'altra
          const used = new Set(this.getOccupiedPositions(cfg.filter(w => w.id !== widgetId)));
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

  const updateConfig = async (id: string, updates: Partial<WidgetConfig>) => widgetConfigService.updateWidgetConfig(id, updates);
  const toggleWidget = async (id: string) => widgetConfigService.toggleWidget(id);
  const changeSize = async (id: string, size: WidgetSize) => widgetConfigService.changeWidgetSize(id, size);
  const reorderWidgets = async (order: WidgetConfig[]) => widgetConfigService.reorderWidgets(order);
  const moveToPosition = async (id: string, pos: number) => widgetConfigService.moveToPosition(id, pos);
  const swapPositions = async (aId: string, bId: string) => widgetConfigService.swapPositions(aId, bId);
  const addWidget = async (id: string, size: WidgetSize = 'small', pos?: number) => widgetConfigService.addWidget(id, size, pos);
  const enableWidget = async (id: string, size: WidgetSize = 'small', pos?: number) => widgetConfigService.enableWidget(id, size, pos); // opzionale
  const removeWidget = async (id: string) => widgetConfigService.removeWidget(id);

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
    calories?: number;
  }): WidgetData[] {
    // mock dei valori correnti (solo per la demo)
    const mock = {
      steps: 0, hydration: 0, mindfulness: 0,
      sleepHours: 0, sleepQuality: 0, hrv: 0, restingHR: 0, analysesCompleted: 0,
      calories: 0, carbs: 0, protein: 0, fat: 0
    };

    const stepsGoal = goals?.steps ?? 10000;
    const hydrationGoal = goals?.hydration ?? 8;
    const meditationGoal = goals?.meditation ?? 30;
    const sleepGoal = goals?.sleep ?? 8;
    const caloriesGoal = goals?.calories ?? 2000;

    return [
      {
        id: 'steps', title: 'Steps', icon: '🚶', color: '#10b981', backgroundColor: '#f0fdf4', category: 'health',
        steps: { current: mock.steps, goal: stepsGoal, km: Math.round(mock.steps * 0.0008 * 100) / 100, calories: Math.round(mock.steps * 0.04) }
      },
      {
        id: 'meditation', title: 'Meditation', icon: '🧘', color: '#8b5cf6', backgroundColor: '#f3f4f6', category: 'wellness',
        meditation: { minutes: mock.mindfulness, goal: meditationGoal, sessions: 2, streak: 5, favoriteType: 'Breathing' }
      },
      {
        id: 'hydration', title: 'Hydration', icon: '💧', color: '#3b82f6', backgroundColor: '#eff6ff', category: 'health',
        hydration: { glasses: mock.hydration, goal: hydrationGoal, ml: mock.hydration * 250, lastDrink: '2h ago' }
      },
      {
        id: 'sleep', title: 'Sleep', icon: '🌙', color: '#6366f1', backgroundColor: '#eef2ff', category: 'health',
        sleep: { hours: mock.sleepHours, quality: mock.sleepQuality, goal: sleepGoal, deepSleep: '2h 15m', remSleep: '1h 45m', bedtime: '11:30 PM', wakeTime: '7:30 AM' }
      },
      {
        id: 'hrv', title: 'HRV', icon: '🫀', color: '#ef4444', backgroundColor: '#fef2f2', category: 'health',
        hrv: { value: mock.hrv, restingHR: mock.restingHR, currentHR: 72, avgHRV: 35, recovery: 'Good' }
      },
      {
        id: 'calories', title: 'Calories', icon: '🔥', color: '#f97316', backgroundColor: '#fff7ed', category: 'health',
        calories: { current: mock.calories, goal: caloriesGoal, carbs: mock.carbs, protein: mock.protein, fat: mock.fat }
      },
      {
        id: 'cycle', title: 'Cycle', icon: '🌸', color: '#ec4899', backgroundColor: '#fdf2f8', category: 'health',
        cycle: { day: 5, phase: 'menstrual', phaseName: 'Menstrual', nextPeriodDays: 24, cycleLength: 28, lastPeriodDate: new Date().toISOString() }
      },
    ];
  }
}
