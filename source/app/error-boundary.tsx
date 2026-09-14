import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error?: Error;
}

/**
 * Last line of defence. Without one, a throw during render is a white screen in
 * release with no way out.
 *
 * Deliberately built from bare React Native primitives: the theme provider,
 * navigation and the database are all inside this boundary, so any of them may
 * be what failed. The message is plain; the stack is developer detail and stays
 * behind __DEV__.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No crash reporter by design — nothing about this app leaves the device.
    if (__DEV__) {
      console.error('Unhandled error', error, info.componentStack);
    }
  }

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected problem. Your conversations and models are
          stored on this device and have not been lost.
        </Text>

        <Pressable
          onPress={() => this.setState({ error: undefined })}
          style={styles.button}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>

        {__DEV__ && (
          <Text style={styles.detail} selectable>
            {error.stack ?? error.message}
          </Text>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: '#fafafa',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#5a5a5a',
  },
  button: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  detail: {
    marginTop: 16,
    fontSize: 11,
    color: '#8a8a8a',
    fontFamily: 'Menlo',
  },
});

export default ErrorBoundary;
