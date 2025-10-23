import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Animated } from 'react-native';
import CheckinCard from './CheckinCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryCTA from './PrimaryCTA';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

const REST_LEVELS = [
  { v:1, emoji:'😴', label:'Exhausted', color:'#ef4444' },
  { v:2, emoji:'😑', label:'Tired',      color:'#f59e0b' },
  { v:3, emoji:'😐', label:'Okay',      color:'#6b7280' },
  { v:4, emoji:'😊', label:'Rested',    color:'#10b981' },
  { v:5, emoji:'😄', label:'Energized', color:'#059669' },
] as const;

type Props = {
  hours: number;
  quality: number;      // 0..100
  bedtime: string;
  waketime: string;
  note?: string;
  onSave: (payload:{ hours:number; quality:number; note:string })=>Promise<void>|void;
  editing: boolean;
  onToggleEdit: ()=>void;
  onChangeQuality?: (q:number)=>void;
};

export default function SleepCheckinCard({
  hours, quality, bedtime, waketime, note: initialNote='', onSave, editing, onToggleEdit,
}: Props) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [restLevel, setRestLevel] = useState<1|2|3|4|5>(3); // Default to "Okay"
  const dirty = note !== initialNote;

  const currentRest = REST_LEVELS.find(r => r.v === restLevel) ?? REST_LEVELS[2];

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

  const handleSave = async () => {
    setSaving(true);
    try { await Promise.resolve(onSave({ hours, quality, note: note.trim() })); }
    finally { setSaving(false); }
  };

  return (
    <CheckinCard
      tint="indigo"
      title="Restful Sleep"
      subtitle="How rested do you feel?"
      headerIcon={<Text style={{fontSize:22}}>🌙</Text>}
      minHeight={350}
      bodyMinHeight={220}
      rightPill={
        <Pressable onPress={onToggleEdit} style={[styles.pill, editing && styles.pillOn]}>
          <MaterialCommunityIcons name={editing ? 'check-circle' : 'pencil'} size={16}
            color={editing ? '#fff' : '#1E3A8A'} />
          <Text style={[styles.pillText, editing && {color:'#fff'}]}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      }
    >
      {/* --- Slider custom --- */}
      <View style={styles.sliderWrap}>
        {/* Etichette emoji */}
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderEmoji}>😴</Text>
          <Text style={styles.sliderEmoji}>😄</Text>
        </View>

        {/* Rail visivo */}
        <View style={styles.rail} />
        
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
                  isActive && styles.dotActive,
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
              onPress={() => { Haptics.selectionAsync(); setRestLevel(v as 1|2|3|4|5); }}
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
          onValueChange={(v) => { Haptics.selectionAsync(); setRestLevel(Math.round(v) as 1|2|3|4|5); }}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor="transparent"
        />
      </View>

      {/* note */}
      <View style={{marginTop:20}}>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="How did you feel when you woke up?"
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          style={styles.textarea}
        />
      </View>

      {/* footer */}
      <View style={{height:12}} />
      <PrimaryCTA
        label="Save Rest Level"
        onPress={handleSave}
        loading={saving}
        disabled={!editing && !dirty}
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
  sliderLabels:{ flexDirection:'row', justifyContent:'space-between', marginBottom:10, paddingHorizontal:2 },
  sliderEmoji:{ fontSize:22 },

  // === rail + dots ===
  rail:{
    height:4, borderRadius:2,
    backgroundColor:'#e2e8f0',
    marginHorizontal:12,
  },
  dotsBar:{
    position:'absolute',
    left:12, right:12,
    top:36,                    // perfetto sopra la rail
    height:18,
    flexDirection:'row', justifyContent:'space-between',
  },
  dotSlot:{ width:1, alignItems:'center', justifyContent:'center' },
  dot:{ width:8, height:8, borderRadius:4, backgroundColor:'#cbd5e1' },
  dotActive:{ backgroundColor:'#3b82f6' },
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

  fieldLabel:{ fontSize:13, fontWeight:'700', color:'#64748b', marginBottom:6 },
  textarea:{ borderWidth:1, borderColor:'#e2e8f0', backgroundColor:'#fff', borderRadius:16, padding:12, minHeight:96,
    fontSize:14, color:'#0f172a' },
});
