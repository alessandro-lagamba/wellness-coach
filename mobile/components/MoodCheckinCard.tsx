import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import CheckinCard from './CheckinCard';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryCTA from './PrimaryCTA';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  value: 1|2|3|4|5;
  note?: string;
  hasExistingCheckin?: boolean; // 🆕 Indica se esiste già un check-in salvato per oggi
  onChange: (v:1|2|3|4|5)=>void;
  onSave: (payload:{ value:1|2|3|4|5; note:string })=>Promise<void>|void;
};

export default function MoodCheckinCard({ value, note: initialNote='', hasExistingCheckin=false, onChange, onSave }: Props) {
  const { t } = useTranslation();
  const { colors: themeColors, mode } = useTheme();
  const MOODS = [
    { v:1, emoji:'☹️', label:t('dailyCheckIn.mood.veryLow'), bg:'#fee2e2' },
    { v:2, emoji:'🙁', label:t('dailyCheckIn.mood.low'),      bg:'#ffedd5' },
    { v:3, emoji:'😐', label:t('dailyCheckIn.mood.okay'),     bg:'#fef9c3' },
    { v:4, emoji:'🙂', label:t('dailyCheckIn.mood.good'),     bg:'#dcfce7' },
    { v:5, emoji:'😄', label:t('dailyCheckIn.mood.great'),    bg:'#bbf7d0' },
  ] as const;
  
  const current = useMemo(()=> MOODS.find(m => m.v === value) ?? MOODS[2], [value, MOODS]);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  // Cambia solo il valore, senza salvare automaticamente
  const handleMoodChange = (newValue: 1|2|3|4|5) => {
    Haptics.selectionAsync();
    onChange(newValue);
  };

  // Salva quando l'utente clicca sul pulsante "Salva Umore"
  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      setSaving(true);
      await Promise.resolve(onSave({ value, note: note.trim() }));
    } finally { setSaving(false); }
  };

  // Gestisce il cambio delle note
  const handleNoteChange = (text: string) => {
    setNote(text);
  };

  return (
    <CheckinCard
      tint="mint"
      title={t('dailyCheckIn.mood.title')}
      subtitle={t('dailyCheckIn.mood.subtitle')}
      headerIcon={<Text style={{fontSize:22}}>😊</Text>}
      minHeight={350}
      bodyMinHeight={220}
    >
      {/* mood picker */}
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {MOODS.map(m => {
          const active = m.v === value;
          return (
            <Pressable key={m.v}
              onPress={() => handleMoodChange(m.v as any)}
              style={[
                styles.segment,
                {
                  backgroundColor: active 
                    ? m.bg 
                    : mode === 'dark' 
                      ? 'rgba(255,255,255,0.15)' // Più chiaro in dark mode
                      : themeColors.surfaceElevated,
                  borderColor: active ? '#10b981' : themeColors.border,
                },
                active && { elevation: 3 }
              ]}
              accessibilityRole="radio" accessibilityState={{selected:active}} accessibilityLabel={m.label}>
              <Text style={[styles.segmentEmoji, active && { transform:[{scale:1.06}] }]}>{m.emoji}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* note */}
      <View style={{marginTop:32}}>
        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('dailyCheckIn.mood.addNote')}</Text>
        <TextInput
          value={note}
          onChangeText={handleNoteChange}
          placeholder={t('dailyCheckIn.mood.notePlaceholder')}
          placeholderTextColor={themeColors.textTertiary}
          multiline
          numberOfLines={4}
          style={[
            styles.textarea,
            {
              backgroundColor: themeColors.surfaceElevated,
              borderColor: themeColors.border,
              color: themeColors.text,
            }
          ]}
        />
      </View>

      {/* footer - mostra sempre il pulsante Salva/Modifica */}
      <View style={{height:12}} />
      <PrimaryCTA
        label={hasExistingCheckin ? t('dailyCheckIn.mood.editMood') : t('dailyCheckIn.mood.saveMood')}
        onPress={handleSave}
        loading={saving}
      />
    </CheckinCard>
  );
}

const styles = StyleSheet.create({
  pill:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:14,
    backgroundColor:'rgba(16,185,129,0.18)', borderWidth:1, borderColor:'#bbf7d0' },
  pillOn:{ backgroundColor:'#10b981', borderColor:'#059669' },
  pillText:{ fontSize:12, fontWeight:'800', color:'#047857' },

  segmentRow:{ flexDirection:'row', justifyContent:'space-between', gap:8, marginTop:8 },
  segment:{ flex:1, height:52, borderRadius:26, borderWidth:1.2,
    alignItems:'center', justifyContent:'center' },
  segmentEmoji:{ fontSize:22, fontWeight:'700' },

  fieldLabel:{ fontSize:13, fontWeight:'700', marginBottom:6 },
  textarea:{ borderWidth:1, borderRadius:16, padding:12, minHeight:96,
    fontSize:14 },
});
