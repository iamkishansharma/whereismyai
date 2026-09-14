import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import GradientText from '@/shared/ui/gradient-text';
import Illustration, {
  type IllustrationName,
} from '@/features/onboarding/components/illustrations';
import StarterModel from '@/features/onboarding/components/starter-model';
import useSettingsStore from '@/features/settings/store';
import type { OnboardingScreenProps } from '@/navigation/types';

interface Slide {
  key: IllustrationName;
  title: string;
  body: string;
}

// Add future capabilities (voice in, voice out) as entries here — the pager
// reads its length, so nothing else needs to change.
const SLIDES: Slide[] = [
  {
    key: 'private',
    title: 'Private by default',
    body: 'Every model runs on this device. Your conversations and photos never leave it, and it all works in airplane mode.',
  },
  {
    key: 'models',
    title: 'Pick your model',
    body: 'Download a model that suits your phone — small and fast, or larger and sharper. Swap between them whenever you like.',
  },
  {
    key: 'images',
    title: 'Show it a photo',
    body: 'With a vision model you can attach a picture and ask about it. The image is read on your device, like everything else.',
  },
  {
    key: 'start',
    title: 'Ready when you are',
    body: 'Grab a small model to begin — it downloads once and then works offline. You can add more later.',
  },
];

const Onboarding = ({ navigation }: OnboardingScreenProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);

  const setShowOnboarding = useSettingsStore(state => state.setShowOnboarding);
  const isLast = index === SLIDES.length - 1;

  const finish = useCallback(
    (openLibrary: boolean) => {
      // Navigate before clearing the flag: flipping it first unmounts this
      // screen and takes its navigation object with it.
      if (openLibrary) {
        navigation.navigate('Main', {
          screen: 'ChatStack',
          params: { screen: 'ModelLibrary' },
        });
      }
      setShowOnboarding(false);
    },
    [navigation, setShowOnboarding],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(current => (current === next ? current : next));
    },
    [width],
  );

  const goNext = useCallback(() => {
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }, [index, width]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.skip}>
        {!isLast && (
          <Button compact onPress={() => finish(false)}>
            Skip
          </Button>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {SLIDES.map((slide, slideIndex) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <Animated.View entering={FadeIn.delay(80).duration(420)}>
              <Illustration name={slide.key} />
            </Animated.View>

            {/* Remount the headline per slide so the entrance replays. */}
            {index === slideIndex && (
              <Animated.View
                entering={FadeInDown.delay(140).duration(420)}
                style={styles.headline}
              >
                <GradientText fontSize={30}>{slide.title}</GradientText>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(220).duration(420)}>
              <Text
                variant="bodyLarge"
                style={[styles.body, { color: colors.onSurfaceVariant }]}
              >
                {slide.body}
              </Text>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, dotIndex) => (
          <View
            key={slide.key}
            style={[
              styles.dot,
              {
                width: dotIndex === index ? 20 : 8,
                backgroundColor:
                  dotIndex === index ? colors.primary : colors.outlineVariant,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        {isLast ? (
          // The last step downloads and selects a starter model in place, so a
          // new install can start chatting without first visiting the library.
          <StarterModel
            onReady={() => finish(false)}
            onBrowseAll={() => finish(false)}
          />
        ) : (
          <Button mode="contained" onPress={goNext} style={styles.cta}>
            Next
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skip: {
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pager: {
    flex: 1,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  headline: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    paddingHorizontal: 24,
  },
  cta: {
    paddingVertical: 4,
  },
});

export default Onboarding;
