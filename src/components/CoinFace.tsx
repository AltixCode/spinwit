import React, { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui";

interface Props {
  /** Bumped on every toss so the animation re-fires even when the face repeats. */
  tossToken: number;
  label: string | null;
}

const FLIP_MS = 420;

/**
 * A quick horizontal flip, synced to reveal the new face at the midpoint -- the same trick a
 * physical flip-card uses, since React Native text has no real backface to hide behind a 3D
 * rotation.
 */
export function CoinFace({ tossToken, label }: Props) {
  const scaleX = useSharedValue(1);

  useEffect(() => {
    if (tossToken === 0) return;
    scaleX.value = withTiming(
      0,
      { duration: FLIP_MS / 2, easing: Easing.in(Easing.quad) },
      () => {
        scaleX.value = withTiming(1, {
          duration: FLIP_MS / 2,
          easing: Easing.out(Easing.quad),
        });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tossToken]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }],
  }));

  return (
    <Animated.View style={style}>
      <Text variant="display">{label ?? "—"}</Text>
    </Animated.View>
  );
}
