import AsyncStorage from '@react-native-async-storage/async-storage';

export type HydrationUnit = 'glass' | 'bottle' | 'liter';

export interface HydrationUnitConfig {
  unit: HydrationUnit;
  mlPerUnit: number; // Millilitri per unità
  label: string; // Etichetta per l'unità (es. "bicchiere", "bottiglia", "litro")
}

const UNIT_CONFIGS: Record<HydrationUnit, HydrationUnitConfig> = {
  glass: { unit: 'glass', mlPerUnit: 250, label: 'Bicchiere' },
  bottle: { unit: 'bottle', mlPerUnit: 500, label: 'Bottiglia' },
  liter: { unit: 'liter', mlPerUnit: 1000, label: 'Litro' },
};

const STORAGE_KEY = 'hydrationUnitPreference';

type UnitChangeListener = () => void;

class HydrationUnitService {
  private listeners: UnitChangeListener[] = [];

  /**
   * Iscriviti ai cambiamenti di unità
   * @returns funzione per disiscriversi
   */
  addListener(listener: UnitChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
  /**
   * Ottiene l'unità preferita dell'utente (default: 'glass')
   */
  async getPreferredUnit(): Promise<HydrationUnit> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (stored === 'glass' || stored === 'bottle' || stored === 'liter')) {
        return stored as HydrationUnit;
      }
      return 'glass'; // Default
    } catch {
      return 'glass';
    }
  }

  /**
   * Imposta l'unità preferita dell'utente
   */
  async setPreferredUnit(unit: HydrationUnit): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, unit);
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving hydration unit preference:', error);
    }
  }

  /**
   * Ottiene la configurazione per un'unità
   */
  getUnitConfig(unit: HydrationUnit): HydrationUnitConfig {
    return UNIT_CONFIGS[unit];
  }

  /**
   * Converte ml in unità preferita
   */
  async mlToPreferredUnit(ml: number): Promise<number> {
    const unit = await this.getPreferredUnit();
    const config = this.getUnitConfig(unit);
    return ml / config.mlPerUnit;
  }

  /**
   * Converte unità preferita in ml
   */
  async preferredUnitToMl(units: number): Promise<number> {
    const unit = await this.getPreferredUnit();
    const config = this.getUnitConfig(unit);
    return units * config.mlPerUnit;
  }

  /**
   * Converte ml in una specifica unità
   */
  mlToUnit(ml: number, unit: HydrationUnit): number {
    const config = this.getUnitConfig(unit);
    return ml / config.mlPerUnit;
  }

  /**
   * Converte una specifica unità in ml
   */
  unitToMl(units: number, unit: HydrationUnit): number {
    const config = this.getUnitConfig(unit);
    return units * config.mlPerUnit;
  }

  /**
   * Ottiene tutte le unità disponibili
   */
  getAllUnits(): HydrationUnitConfig[] {
    return Object.values(UNIT_CONFIGS);
  }
}

export const hydrationUnitService = new HydrationUnitService();






