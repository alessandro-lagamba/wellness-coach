import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Animated } from 'react-native';
import CheckinCard from './CheckinCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryCTA from './PrimaryCTA';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  hours: number;
  quality: number;      // 0..100
  bedtime: string;
  waketime: string;
  note?: string;
  hasExistingCheckin?: boolean; // 🆕 Indica se esiste già un check-in salvato per oggi
  onSave: (payload:{ hours:number; quality:number; note:string })=>Promise<void>|void;
  restLevel?: 1|2|3|4|5;
  onChangeRestLevel?: (level:1|2|3|4|5)=>void;
};

export default function SleepCheckinCard({
  hours, quality, bedtime, waketime, note: initialNote='', hasExistingCheckin=false, onSave, restLevel: initialRestLevel=3, onChangeRestLevel,
}: Props) {
  const { t } = useTranslation();
  const { colors: themeColors, mode } = useTheme();
  const REST_LEVELS = [
    { v:1, emoji:'😴', label:t('dailyCheckIn.sleep.exhausted'), color:'#ef4444' },
    { v:2, emoji:'😑', label:t('dailyCheckIn.sleep.tired'),      color:'#f59e0b' },
    { v:3, emoji:'😐', label:t('dailyCheckIn.sleep.okay'),      color:'#6b7280' },
    { v:4, emoji:'😊', label:t('dailyCheckIn.sleep.rested'),    color:'#10b981' },
    { v:5, emoji:'😄', label:t('dailyCheckIn.sleep.energized'), color:'#059669' },
  ] as const;
  
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [restLevel, setRestLevel] = useState<1|2|3|4|5>(initialRestLevel);

  const currentRest = REST_LEVELS.find(r => r.v === restLevel) ?? REST_LEVELS[2];

  // Cambia solo il livello di riposo, senza salvare automaticamente
  const handleRestLevelChange = (newLevel: 1|2|3|4|5) => {
    Haptics.selectionAsync();
    setRestLevel(newLevel);
    if (onChangeRestLevel) {
      onChangeRestLevel(newLevel);
    }
  };

  // Salva quando l'utente clicca sul pulsante "Salva Riposo"
  const handleSave = async () => {
    // Mappa il restLevel (1-5) a quality (0-100) per compatibilità
    const qualityFromRestLevel = ((restLevel - 1) / 4) * 100; // 1->0%, 2->25%, 3->50%, 4->75%, 5->100%
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      setSaving(true);
      await Promise.resolve(onSave({ hours, quality: qualityFromRestLevel, note: note.trim() }));
    } finally { setSaving(false); }
  };

  // Gestisce il cambio delle note
  const handleNoteChange = (text: string) => {
    setNote(text);
  };

  // animazione per i pallini
  const anim = useRef(new Animated.Value(restLevel)).current;

  // quando cambia il livello, fai partire l'animazione
  useEffect(() => {
    Animated.spring(anim, {
      toValue: restLevel,
      stiffness: 220,
      damping: 18,
      mass: 0.6,
      useNativeDriver: true, // anima solo scale/opacity
    }).start();
  }, [restLevel]);


  return (
    <CheckinCard
      tint="indigo"
      title={t('dailyCheckIn.sleep.title')}
      subtitle={t('dailyCheckIn.sleep.subtitle')}
      headerIcon={<Text style={{fontSize:22}}>🌙</Text>}
      minHeight={350}
      bodyMinHeight={220}
    >
      {/* --- Slider custom --- */}
      <View style={styles.sliderWrap}>
        {/* Etichette emoji */}
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderEmoji}>😴</Text>
          <Text style={styles.sliderEmoji}>😄</Text>
        </View>

        {/* Rail visivo - più chiaro in dark mode */}
        <View style={[styles.rail, { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(255,255,255,0.3)' // Bianco semi-trasparente in dark mode
            : themeColors.borderLight 
        }]} />
        
        {/* Pallini + halo sopra il rail */}
        <View style={styles.dotsBar} pointerEvents="none">
          {[1,2,3,4,5].map((v) => {
            const scale = anim.interpolate({
              inputRange: [1,2,3,4,5],
              outputRange: [ v===1?1.5:1.0, v===2?1.5:1.0, v===3?1.5:1.0, v===4?1.5:1.0, v===5?1.5:1.0 ],
            });
            const opacity = anim.interpolate({
              inputRange: [1,2,3,4,5],
              outputRange: [ v===1?1:0.55, v===2?1:0.55, v===3?1:0.55, v===4?1:0.55, v===5?1:0.55 ],
            });
            const isActive = v === restLevel;

            return (
              <View key={v} style={styles.dotSlot}>
                {isActive && (
                  <Animated.View style={[styles.dotHalo, { transform:[{scale}], opacity }]} />
                )}
                <Animated.View style={[
                  styles.dot,
                  {
                    backgroundColor: isActive 
                      ? '#3b82f6' 
                      : mode === 'dark' 
                        ? 'rgba(255,255,255,0.4)' // Più chiaro in dark mode
                        : themeColors.border,
                  },
                  { transform:[{scale}], opacity }
                ]}/>
              </View>
            );
          })}
        </View>

        {/* Overlay tappabile in 5 segmenti */}
        <View style={styles.tapOverlay}>
          {[1,2,3,4,5].map(v => (
            <Pressable
              key={v}
              style={styles.tapHit}
              onPress={() => handleRestLevelChange(v as 1|2|3|4|5)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Select ${v}`}
            />
          ))}
        </View>

        {/* Slider nativo invisibile: serve solo per il drag */}
        <Slider
          style={styles.sliderGhost}
          minimumValue={1}
          maximumValue={5}
          step={1}
          value={restLevel}
          onValueChange={(v) => handleRestLevelChange(Math.round(v) as 1|2|3|4|5)}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor="transparent"
        />
      </View>

      {/* note */}
      <View style={{marginTop:20}}>
        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('dailyCheckIn.sleep.notes')}</Text>
        <TextInput
          value={note}
          onChangeText={handleNoteChange}
          placeholder={t('dailyCheckIn.sleep.notesPlaceholder')}
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
        label={hasExistingCheckin ? t('dailyCheckIn.sleep.editRestLevel') : t('dailyCheckIn.sleep.saveRestLevel')}
        onPress={handleSave}
        loading={saving}
      />
    </CheckinCard>
  );
}

const styles = StyleSheet.create({
  pill:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:14,
    backgroundColor:'rgba(59,130,246,0.12)', borderWidth:1, borderColor:'#bfdbfe' },
  pillOn:{ backgroundColor:'#3b82f6', borderColor:'#1d4ed8' },
  pillText:{ fontSize:12, fontWeight:'800', color:'#1E3A8A' },

  // === layout base ===
  sliderWrap:{ marginTop:8, position:'relative', paddingTop:8, paddingBottom:10 },
  sliderLabels:{ flexDirection:'row', justifyContent:'space-between', marginBottom:16, paddingHorizontal:2, marginTop: -4 },
  sliderEmoji:{ fontSize:22 },

  // === rail + dots ===
  rail:{
    height:4, borderRadius:2,
    marginHorizontal:12,
    // Background gestito inline con themeColors.borderLight
  },
  dotsBar:{
    position:'absolute',
    left:12, right:12,
    top:36,                    // perfetto sopra la rail
    height:18,
    flexDirection:'row', justifyContent:'space-between',
  },
  dotSlot:{ width:1, alignItems:'center', justifyContent:'center' },
  dot:{ width:8, height:8, borderRadius:4 }, // Background gestito inline
  dotActive:{ backgroundColor:'#3b82f6' }, // Sempre blu quando attivo
  dotHalo:{
    position:'absolute',
    width:22, height:22, borderRadius:11,
    backgroundColor:'rgba(59,130,246,0.18)',
  },

  // === tap overlay & slider ghost ===
  tapOverlay:{
    position:'absolute', left:0, right:0,
    top:24, height:36,
    flexDirection:'row', paddingHorizontal:12, zIndex:3,
  },
  tapHit:{ flex:1 },

  sliderGhost:{
    position:'absolute', left:0, right:0, top:16, height:48,
    opacity:0.02,         // quasi invisibile, ma trascinabile
    zIndex:2,
  },

  fieldLabel:{ fontSize:13, fontWeight:'700', marginBottom:6 },
  textarea:{ borderWidth:1, borderRadius:16, padding:12, minHeight:96,
    fontSize:14 },
});
