import { Alert, Linking } from 'react-native';
import { AudioManager, type PermissionStatus } from 'react-native-audio-api';

import { isIOS } from '@/shared/utils';

/**
 * The device audio session: who owns the mic and speaker, and whether we are
 * allowed to listen at all. Everything that records or plays goes through here
 * first so the session is configured exactly once per call.
 */

/**
 * Ask for the microphone, prompting only when the answer isn't already known.
 *
 * `AudioManager` covers both platforms, so there is no `PermissionsAndroid`
 * branch to maintain.
 */
export async function ensureMicPermission(): Promise<PermissionStatus> {
  const current = await AudioManager.checkRecordingPermissions();
  if (current === 'Granted') {
    return current;
  }
  return AudioManager.requestRecordingPermissions();
}

/**
 * Explain a refusal and offer the only place it can be undone.
 *
 * Once the OS has recorded a denial it will not prompt again, so re-asking is
 * pointless — Settings is the only route back.
 */
export function explainMicDenied(): void {
  Alert.alert(
    'Microphone access is off',
    `${
      isIOS ? 'whereismyai' : 'This app'
    } needs the microphone to hear you. Your voice is transcribed on this device and never leaves it.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ],
  );
}

/**
 * Configure the session for a two-way voice call.
 *
 * `voiceChat` is the mode that enables acoustic echo cancellation on iOS, which
 * is what stops the assistant's own voice from retriggering the microphone.
 * `defaultToSpeaker` keeps a phone-shaped call out of the earpiece.
 */
export function configureVoiceSession(): void {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'voiceChat',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP', 'duckOthers'],
    iosNotifyOthersOnDeactivation: true,
  });
}

/**
 * Configure the session for dictation — recording only, nothing plays back.
 *
 * Kept separate from {@link configureVoiceSession} because `playAndRecord`
 * routes and ducks audio the composer's mic button has no business touching.
 */
export function configureDictationSession(): void {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'record',
    iosMode: 'measurement',
    iosOptions: ['allowBluetoothHFP'],
    iosNotifyOthersOnDeactivation: true,
  });
}

export async function activateSession(): Promise<void> {
  await AudioManager.setAudioSessionActivity(true);
}

/**
 * Hand the session back so music and podcasts can resume.
 *
 * Deliberately swallows its error: this runs from teardown paths where the
 * session may already be gone, and failing to release it must never be what
 * breaks leaving a screen.
 */
export async function deactivateSession(): Promise<void> {
  try {
    await AudioManager.setAudioSessionActivity(false);
  } catch {
    // Already inactive, or the OS took it back first. Nothing to do.
  }
}

export type { PermissionStatus };
