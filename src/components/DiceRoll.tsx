import React, { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui";

interface Props {
  /** Bumped on every roll so the animation re-fires even when the total repeats. */
  rollToken: number;
  label: string;
}

const SHAKE_MS = 380;

/** A short settle-in shake, echoing how physical dice wobble to a stop rather than snapping. */
export function DiceRoll({ rollToken, label }: Props) {
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (rollToken === 0) return;
    shake.value = withSequence(
      withTiming(1, { duration: SHAKE_MS / 6, easing: Easing.linear }),
      withTiming(-1, { duration: SHAKE_MS / 6, easing: Easing.linear }),
      withTiming(0.6, { duration: SHAKE_MS / 6, easing: Easing.linear }),
      withTiming(-0.6, { duration: SHAKE_MS / 6, easing: Easing.linear }),
      withTiming(0, {
        duration: SHAKE_MS / 3,
        easing: Easing.out(Easing.quad),
      }),
    );
    scale.value = withSequence(
      withTiming(1.08, { duration: SHAKE_MS / 2 }),
      withTiming(1, { duration: SHAKE_MS / 2 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollToken]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 6 }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Text variant="display" align="center">
        {label}
      </Text>
    </Animated.View>
  );
}
