import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import OrbRing from './orb-ring';

export type VoicePhase =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'preparing'
  | 'speaking'
  | 'error';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRadialGradient = Animated.createAnimatedComponent(RadialGradient);

/**
 * The orb: one soft sphere that breathes, reacts to sound, and shows which way
 * the conversation is currently flowing.
 *
 * Built from SVG and Reanimated because this project has no Skia. Animating a
 * handful of circle radii and one gradient focal point is cheap on Fabric;
 * animating a path would not be.
 */

const BOX = 260;
const CENTRE = BOX / 2;
const CORE_R = 62;
const HALO_R = 118;
const RING_COUNT = 3;
const RIPPLE_SPAN = HALO_R - CORE_R;

const BREATHE_MS = 4200;
const FOCUS_MS = 7000;

// How alive the orb looks in each state. Listening is the most animated
// because it is the only state where the user is the one doing something.
const ENERGY: Record<VoicePhase, number> = {
  idle: 0,
  listening: 1,
  thinking: 0.45,
  preparing: 0.3,
  speaking: 0.8,
  error: 0.15,
};

// Only the states where sound is actually moving get ripples.
const RIPPLE_MS: Partial<Record<VoicePhase, number>> = {
  listening: 2200,
  speaking: 1300,
};

interface VoiceOrbProps {
  phase: VoicePhase;
  /** 0..1 loudness of whoever is talking. */
  level: number;
}

const VoiceOrb = ({ phase, level }: VoiceOrbProps) => {
  const { colors } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  const breathe = useSharedValue(0);
  const energy = useSharedValue(0);
  const amplitude = useSharedValue(0);
  const ripple = useSharedValue(0);
  const focus = useSharedValue(0);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  // The slow breath never stops, so a state change never starts from a dead
  // stop — the orb always looks alive rather than switched on.
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(breathe);
      cancelAnimation(focus);
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    focus.value = withRepeat(
      withTiming(1, { duration: FOCUS_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [breathe, focus, reduceMotion]);

  useEffect(() => {
    energy.value = withSpring(ENERGY[phase], { damping: 14, stiffness: 90 });

    cancelAnimation(ripple);
    const duration = RIPPLE_MS[phase];
    if (duration && !reduceMotion) {
      ripple.value = 0;
      ripple.value = withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    } else {
      ripple.value = withTiming(0, { duration: 360 });
    }
  }, [energy, phase, reduceMotion, ripple]);

  // Assigned from JS at chunk rate rather than per frame, which is well within
  // what a shared value is happy to take.
  useEffect(() => {
    amplitude.value = withTiming(level, { duration: 120 });
  }, [amplitude, level]);

  const coreProps = useAnimatedProps(() => {
    const breath = 1 + 0.05 * Math.sin(breathe.value * Math.PI * 2);
    const react = 1 + energy.value * (0.1 + 0.3 * amplitude.value);
    return { r: CORE_R * breath * react };
  });

  const haloProps = useAnimatedProps(() => ({
    r: HALO_R * (1 + 0.08 * energy.value + 0.2 * amplitude.value),
    opacity: 0.35 + 0.5 * energy.value,
  }));

  // Thinking gets no ripples; instead the highlight drifts inside the sphere,
  // which reads as work happening rather than as listening.
  const focusProps = useAnimatedProps(() => {
    const angle = focus.value * Math.PI * 2;
    const reach = 0.16 * energy.value;
    return {
      fx: `${0.5 + reach * Math.cos(angle)}`,
      fy: `${0.5 + reach * Math.sin(angle)}`,
    };
  });

  const tint = phase === 'error' ? colors.error : colors.primary;

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={BOX} height={BOX}>
        <Defs>
          <AnimatedRadialGradient
            id="orbCore"
            cx="0.5"
            cy="0.5"
            r="0.5"
            animatedProps={focusProps}
          >
            <Stop offset="0" stopColor={tint} stopOpacity="1" />
            <Stop
              offset="0.55"
              stopColor={colors.tertiary}
              stopOpacity="0.85"
            />
            <Stop offset="1" stopColor={colors.secondary} stopOpacity="0.15" />
          </AnimatedRadialGradient>
          <RadialGradient id="orbHalo" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0.6" stopColor={tint} stopOpacity="0.18" />
            <Stop offset="1" stopColor={tint} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <AnimatedCircle
          cx={CENTRE}
          cy={CENTRE}
          fill="url(#orbHalo)"
          animatedProps={haloProps}
        />

        {Array.from({ length: RING_COUNT }, (_, index) => (
          <OrbRing
            key={index}
            index={index}
            count={RING_COUNT}
            centre={CENTRE}
            innerRadius={CORE_R}
            span={RIPPLE_SPAN}
            ripple={ripple}
            energy={energy}
          />
        ))}

        <AnimatedCircle
          cx={CENTRE}
          cy={CENTRE}
          fill="url(#orbCore)"
          animatedProps={coreProps}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceOrb;
