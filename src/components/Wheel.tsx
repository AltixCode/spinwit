import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { G, Path, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';

interface Props {
  entries: readonly string[];
  /** Absolute rotation to animate to, in degrees. Changing it starts a spin. */
  angle: number;
  spinning: boolean;
  onSettled: () => void;
  size: number;
}

/** How long a spin takes. Long enough to feel like one, short enough not to be a wait. */
const SPIN_MS = 3200;

/** An SVG wedge from `from` to `to` degrees, measured clockwise from the top. */
function wedge(cx: number, cy: number, r: number, from: number, to: number): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(from));
  const y1 = cy + r * Math.sin(rad(from));
  const x2 = cx + r * Math.cos(rad(to));
  const y2 = cy + r * Math.sin(rad(to));
  const large = to - from > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * The wheel.
 *
 * It only *shows* the result — `angle` is computed from a winner that was already drawn, so
 * nothing about this component decides anything. The deceleration curve is a cubic ease-out so
 * the last few degrees crawl, which is what makes a spin feel like a spin.
 */
export function Wheel({ entries, angle, spinning, onSettled, size }: Props) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!spinning) return;
    rotation.value = withTiming(
      angle,
      { duration: SPIN_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) },
      (finished) => {
        'worklet';
        // `onSettled` is a JS function; calling it straight from the animation callback, which
        // runs on the UI thread, throws "Tried to synchronously call a Remote Function".
        if (finished) runOnJS(onSettled)();
      },
    );
  }, [angle, spinning, rotation, onSettled]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const r = size / 2;
  const count = Math.max(entries.length, 1);
  const segment = 360 / count;
  const palette = [colors.accent, colors.surfaceAlt];

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size}>
          <G>
            {entries.map((entry, i) => {
              const from = i * segment;
              const to = from + segment;
              const mid = from + segment / 2;
              const rad = ((mid - 90) * Math.PI) / 180;
              const tx = r + r * 0.62 * Math.cos(rad);
              const ty = r + r * 0.62 * Math.sin(rad);
              const fill = palette[i % palette.length]!;
              return (
                <G key={`${entry}-${i}`}>
                  <Path d={wedge(r, r, r - 2, from, to)} fill={fill} stroke={colors.background} strokeWidth={2} />
                  <SvgText
                    x={tx}
                    y={ty}
                    fill={i % 2 === 0 ? colors.onAccent : colors.text}
                    fontSize={Math.max(10, size * 0.045)}
                    fontWeight="600"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${mid}, ${tx}, ${ty})`}
                  >
                    {entry.length > 12 ? `${entry.slice(0, 11)}…` : entry}
                  </SvgText>
                </G>
              );
            })}
            <SvgCircle cx={r} cy={r} r={r * 0.13} fill={colors.background} />
          </G>
        </Svg>
      </Animated.View>
      {/* The pointer sits outside the rotating layer, at the top. */}
      <View style={[styles.pointer, { borderTopColor: colors.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  pointer: {
    position: 'absolute',
    top: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
