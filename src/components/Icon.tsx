/**
 * The one icon component.
 *
 * Paths are authored on a 24 grid and scaled by a group transform, so the 1.5
 * stroke scales with the glyph: a 48 pt icon gets a 3 pt stroke, which is what
 * keeps the family looking like one family at every size.
 *
 * This replaces every `View`-with-border glyph in GameScreen. Those relied on
 * `borderLeftWidth`/`borderTopColor: 'transparent'` triangle tricks, which have
 * no shared grid, no consistent stroke weight, and no optical centring.
 */

import React, {useMemo} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {Canvas, Group, Path, Skia} from '@shopify/react-native-skia';

import {ICON_GRID, ICON_STROKE_WIDTH, ICONS, IconName} from './icons';
import {palette} from '../theme';

interface Props {
  name: IconName;
  /** Rendered size in points. Defaults to 24. */
  size?: number;
  color?: string;
  opacity?: number;
  /** Override only when a glyph needs to hold up on a light ground. */
  strokeWidth?: number;
  style?: ViewStyle;
}

export function Icon({
  name,
  size = 24,
  color = palette.text,
  opacity = 1,
  strokeWidth = ICON_STROKE_WIDTH,
  style,
}: Props) {
  const definition = ICONS[name];

  const fills = useMemo(
    () =>
      definition.fill
        .map(d => Skia.Path.MakeFromSVGString(d))
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [definition],
  );

  const strokes = useMemo(
    () =>
      definition.stroke
        .map(d => Skia.Path.MakeFromSVGString(d))
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [definition],
  );

  const scale = size / ICON_GRID;

  return (
    <Canvas style={[{width: size, height: size}, style]}>
      <Group transform={[{scale}]} opacity={opacity}>
        {fills.map((path, i) => (
          <Path key={`f${i}`} path={path} color={color} style="fill" />
        ))}
        {strokes.map((path, i) => (
          <Path
            key={`s${i}`}
            path={path}
            color={color}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="butt"
            strokeJoin="miter"
            strokeMiter={4}
          />
        ))}
      </Group>
    </Canvas>
  );
}

/**
 * An icon inside a 44 x 44 touch target, per the iOS HIG minimum. The glyph
 * stays at its optical size; only the tappable area grows.
 */
export function IconButtonBody({
  name,
  size = 24,
  color,
  opacity,
}: Pick<Props, 'name' | 'size' | 'color' | 'opacity'>) {
  return (
    <View style={styles.target}>
      <Icon name={name} size={size} color={color} opacity={opacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  target: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
