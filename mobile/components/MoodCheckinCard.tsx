import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import CheckinCard from './CheckinCard';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryCTA from './PrimaryCTA';

const MOODS = [
  { v:1, emoji:'☹️', label:'Very low', bg:'#fee2e2' },
  { v:2, emoji:'🙁', label:'Low',      bg:'#ffedd5' },
  { v:3, emoji:'😐', label:'Okay',     bg:'#fef9c3' },
  { v:4, emoji:'🙂', label:'Good',     bg:'#dcfce7' },
  { v:5, emoji:'😄', label:'Great',    bg:'#bbf7d0' },
] as const;

type Props = {
  value: 1|2|3|4|5;
  note?: string;
  onChange: (v:1|2|3|4|5)=>void;
  onSave: (payload:{ value:1|2|3|4|5; note:string })=>Promise<void>|void;
  editing: boolean;
  onToggleEdit: ()=>void;
};

export default function MoodCheckinCard({ value, note: initialNote='', onChange, onSave, editing, onToggleEdit }: Props) {
  const current = useMemo(()=> MOODS.find(m => m.v === value) ?? MOODS[2], [value]);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [savedAtLeastOnce, setSaved] = useState(false);

  const dirty = (note ?? '') !== (initialNote ?? '');

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      setSaving(true);
      await Promise.resolve(onSave({ value, note: note.trim() }));
      setSaved(true);
    } finally { setSaving(false); }
  };

  return (
    <CheckinCard
      tint="mint"
      title="Mood Balance"
      subtitle="How are you feeling today?"
      headerIcon={<Text style={{fontSize:22}}>😊</Text>}
      minHeight={350}
      bodyMinHeight={220}
      rightPill={
        <Pressable onPress={onToggleEdit} style={[styles.pill, editing && styles.pillOn]}>
          <MaterialCommunityIcons name={editing ? 'check-circle' : 'pencil'} size={16} color={editing ? '#fff':'#047857'} />
          <Text style={[styles.pillText, editing && {color:'#fff'}]}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      }
    >
      {/* mood picker */}
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {MOODS.map(m => {
          const active = m.v === value;
          return (
            <Pressable key={m.v}
              onPress={() => { Haptics.selectionAsync(); onChange(m.v as any); }}
              style={[styles.segment, active && { backgroundColor:m.bg, borderColor:'#10b981', elevation:3}]}
              accessibilityRole="radio" accessibilityState={{selected:active}} accessibilityLabel={m.label}>
              <Text style={[styles.segmentEmoji, active && { transform:[{scale:1.06}] }]}>{m.emoji}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* note */}
      <View style={{marginTop:32}}>
        <Text style={styles.fieldLabel}>Add a note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Write about your feelings…"
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          style={styles.textarea}
        />
      </View>

      {/* footer */}
      <View style={{height:12}} />
      <PrimaryCTA
        label={savedAtLeastOnce && !dirty ? 'Saved' : 'Save Mood'}
        onPress={handleSave}
        loading={saving}
        disabled={!editing && !dirty}
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
  segment:{ flex:1, height:52, borderRadius:26, borderWidth:1.2, borderColor:'#e2e8f0', backgroundColor:'#fff',
    alignItems:'center', justifyContent:'center' },
  segmentEmoji:{ fontSize:22, fontWeight:'700' },

  fieldLabel:{ fontSize:13, fontWeight:'700', color:'#64748b', marginBottom:6 },
  textarea:{ borderWidth:1, borderColor:'#e2e8f0', backgroundColor:'#fff', borderRadius:16, padding:12, minHeight:96,
    fontSize:14, color:'#0f172a' },
});
