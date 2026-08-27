import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const SWEEP_MS = 3200;

interface GradientTextProps {
  children: string;
  fontSize?: number;
  fontWeight?: string;
  style?: StyleProp<ViewStyle>;
}

const GradientText = ({
  children,
  fontSize = 30,
  fontWeight = '700',
  style,
}: GradientTextProps) => {
  const { colors } = useTheme();
  const sweep = useSharedValue(-1);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [sweep]);

  // Animating the gradient's own coordinates is what makes the shimmer travel;
  // the text itself never moves.
  const animatedProps = useAnimatedProps(() => ({
    x1: `${sweep.value * 100}%`,
    x2: `${(sweep.value + 1) * 100}%`,
  }));

  const height = fontSize * 1.35;

  return (
    <View
      style={style}
      accessibilityRole="header"
      accessibilityLabel={children}
    >
      {/* SVG text is invisible to screen readers, so the label above carries it
          and the drawing below is hidden from assistive tech. */}
      <Svg
        width="100%"
        height={height}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <AnimatedGradient
            id="sweep"
            animatedProps={animatedProps}
            y1="0"
            y2="0"
          >
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="0.5" stopColor={colors.tertiary} />
            <Stop offset="1" stopColor={colors.secondary} />
          </AnimatedGradient>
        </Defs>
        <SvgText
          x="50%"
          y={fontSize}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill="url(#sweep)"
        >
          {children}
        </SvgText>
      </Svg>
    </View>
  );
};

export default GradientText;
