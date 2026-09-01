/**
 * Softly chamfered rectangles, no gradients, no celebratory flourish. The
 * interface is an emergency-analysis instrument.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

import {palette} from '../theme';

type Variant = 'primary' | 'secondary' | 'quiet';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.base,
        variantStyle[variant],
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}>
      <Text
        maxFontSizeMultiplier={1.6}
        style={[styles.label, labelStyle[variant]]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {opacity: 0.7},
  disabled: {opacity: 0.35},
  label: {fontSize: 15, fontWeight: '600', letterSpacing: 0.4},
});

const variantStyle: Record<Variant, ViewStyle> = {
  primary: {backgroundColor: palette.wall},
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.structure,
  },
  quiet: {backgroundColor: 'transparent', paddingHorizontal: 10},
};

const labelStyle: Record<Variant, TextStyle> = {
  primary: {color: palette.background},
  secondary: {color: palette.text},
  quiet: {color: palette.textMuted},
};
