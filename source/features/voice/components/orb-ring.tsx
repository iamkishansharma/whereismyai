import { useTheme } from 'react-native-paper';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * One ripple travelling out from the orb.
 *
 * A child component per ring rather than a loop inside the parent so each keeps
 * its own hook call — the same reason the typing indicator gives each dot its
 * own component.
 */

interface OrbRingProps {
  index: number;
  count: number;
  centre: number;
  innerRadius: number;
  span: number;
  /** 0..1 looping ripple phase, shared by every ring. */
  ripple: SharedValue<number>;
  /** 0..1 how alive the orb currently is. */
  energy: SharedValue<number>;
}

const OrbRing = ({
  index,
  count,
  centre,
  innerRadius,
  span,
  ripple,
  energy,
}: OrbRingProps) => {
  const { colors } = useTheme();

  const props = useAnimatedProps(() => {
    // Rings are evenly offset around the same loop, so they read as a train of
    // ripples rather than one ring blinking.
    const phase = (ripple.value + index / count) % 1;
    const fade = (1 - phase) * (1 - phase);
    return {
      r: innerRadius + phase * span,
      strokeOpacity: energy.value * fade * 0.55,
    };
  });

  return (
    <AnimatedCircle
      cx={centre}
      cy={centre}
      fill="none"
      strokeWidth={1.5}
      stroke={colors.primary}
      animatedProps={props}
    />
  );
};

export default OrbRing;
