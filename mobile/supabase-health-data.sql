-- SQL per creare la tabella health_data in Supabase
CREATE TABLE IF NOT EXISTS health_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER DEFAULT 0,
  distance DECIMAL(10,2) DEFAULT 0, -- meters
  calories INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  heart_rate INTEGER DEFAULT 0, -- bpm
  resting_heart_rate INTEGER DEFAULT 0, -- bpm
  hrv INTEGER DEFAULT 0, -- Heart Rate Variability in ms
  sleep_hours DECIMAL(4,2) DEFAULT 0,
  sleep_quality INTEGER DEFAULT 0, -- 0-100
  deep_sleep_minutes INTEGER DEFAULT 0,
  rem_sleep_minutes INTEGER DEFAULT 0,
  light_sleep_minutes INTEGER DEFAULT 0,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  weight DECIMAL(5,2), -- kg
  body_fat DECIMAL(5,2), -- percentage
  hydration INTEGER, -- ml
  mindfulness_minutes INTEGER,
  source TEXT NOT NULL CHECK (source IN ('healthkit', 'health_connect', 'manual', 'mock')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per evitare duplicati
  UNIQUE(user_id, date)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_health_data_user_id ON health_data(user_id);
CREATE INDEX IF NOT EXISTS idx_health_data_date ON health_data(date);
CREATE INDEX IF NOT EXISTS idx_health_data_user_date ON health_data(user_id, date);

-- RLS (Row Level Security)
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;

-- Policy per permettere agli utenti di vedere solo i propri dati
CREATE POLICY "Users can view own health data" ON health_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health data" ON health_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health data" ON health_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health data" ON health_data
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_health_data_updated_at 
  BEFORE UPDATE ON health_data 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

