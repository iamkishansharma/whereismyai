import React, { useEffect, useState } from 'react';
import {
  Modal,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { IconButton, Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MAX_SCALE = 5;

/**
 * Full-screen viewer for a chat image (attached photo or generated picture).
 * Pinch to zoom, drag to pan while zoomed, double-tap to toggle zoom, single-tap
 * (or the close button) to dismiss. Share via the system sheet or save to Photos.
 */
const ImageViewer = ({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [snack, setSnack] = useState('');

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Reset the transform whenever the viewer opens/closes.
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [uri, scale, savedScale, tx, ty, savedTx, savedTy]);

  const onShare = async () => {
    if (!uri) return;
    try {
      await Share.share({ url: uri });
    } catch {
      // user dismissed / share failed
    }
  };

  const onSave = async () => {
    if (!uri) return;
    try {
      // await CameraRoll.saveAsset(uri, { type: 'photo' });
      setSnack('Saved to Photos');
    } catch {
      setSnack('Could not save image');
    }
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(1, savedScale.value * e.scale),
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onClose)();
    });

  const gesture = Gesture.Simultaneous(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.backdrop}>
            {uri ? (
              <Animated.Image
                source={{ uri }}
                style={[{ width, height }, animatedStyle]}
                resizeMode="contain"
              />
            ) : null}
          </Animated.View>
        </GestureDetector>

        <View style={[styles.bar, { top: insets.top + 8 }]}>
          <IconButton
            icon="share-variant"
            iconColor="#fff"
            size={24}
            onPress={onShare}
          />
          <IconButton
            icon="tray-arrow-down"
            iconColor="#fff"
            size={24}
            onPress={onSave}
          />
          <IconButton
            icon="close"
            iconColor="#fff"
            size={28}
            onPress={onClose}
          />
        </View>

        <Snackbar
          visible={!!snack}
          onDismiss={() => setSnack('')}
          duration={2000}
          style={{ marginBottom: insets.bottom + 16 }}
        >
          {snack}
        </Snackbar>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default ImageViewer;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
