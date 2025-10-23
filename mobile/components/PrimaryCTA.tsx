import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';

export default function PrimaryCTA({
  label, onPress, disabled, loading, style,
}: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={isDisabled}
      style={({pressed}) => [s.btn, isDisabled && s.btnDis, pressed && {transform:[{scale:0.99}]}, style]}>
      {loading ? <ActivityIndicator/> : <Text style={s.txt}>{label}</Text>}
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn:{height:52,borderRadius:16,alignItems:'center',justifyContent:'center',
    backgroundColor:'#3b82f6',shadowColor:'#3b82f6',shadowOpacity:0.15,shadowOffset:{width:0,height:8},shadowRadius:8,elevation:4},
  btnDis:{opacity:0.5},
  txt:{color:'#fff',fontSize:16,fontWeight:'800',letterSpacing:0.2},
});
