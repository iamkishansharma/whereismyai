import { useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
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

const SWEEP_MS = 1500;

interface ShimmerTextProps {
  children: string;
  fontSize?: number;
  fontWeight?: string;
}

/**
 * A short label with a highlight travelling across it, for work happening now.
 *
 * Rendered twice: real Text owns the layout and the screen reader, SVG on top
 * carries the moving gradient. Measuring the first sizes the second, so the
 * highlight is exactly as wide as the word and shoves nothing aside.
 */
const ShimmerText = ({
  children,
  fontSize = 13,
  fontWeight = '500',
}: ShimmerTextProps) => {
  const { colors } = useTheme();
  // Two of these on screen would otherwise share one gradient definition.
  const gradientId = `shimmer-${useId()}`;
  const [size, setSize] = useState({ width: 0, height: 0 });

  const sweep = useSharedValue(-1);
  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [sweep]);

  // The gradient's coordinates move; the glyphs never do.
  const animatedProps = useAnimatedProps(() => ({
    x1: `${sweep.value * 100}%`,
    x2: `${(sweep.value + 0.7) * 100}%`,
  }));

  const measured = size.width > 0;

  return (
    <View accessibilityLabel={children}>
      <Text
        variant="labelMedium"
        onLayout={event => setSize(event.nativeEvent.layout)}
        // Stays mounted once measured: it owns the layout, the SVG just paints.
        style={{ color: colors.onSurfaceVariant, opacity: measured ? 0 : 1 }}
      >
        {children}
      </Text>

      {measured && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Defs>
            <AnimatedGradient
              id={gradientId}
              animatedProps={animatedProps}
              y1="0"
              y2="0"
            >
              <Stop offset="0" stopColor={colors.onSurfaceVariant} />
              <Stop offset="0.5" stopColor={colors.onSurface} />
              <Stop offset="1" stopColor={colors.onSurfaceVariant} />
            </AnimatedGradient>
          </Defs>
          <SvgText
            x="0"
            y={fontSize}
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill={`url(#${gradientId})`}
          >
            {children}
          </SvgText>
        </Svg>
      )}
    </View>
  );
};

export default ShimmerText;
