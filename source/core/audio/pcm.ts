/**
 * PCM format helpers. Pure arithmetic on sample buffers — no native calls, no
 * state — so the conversions that sit between the recorder, whisper and the
 * player can be reasoned about and tested on their own.
 */

/** What whisper.cpp expects: mono, signed 16-bit, 16 kHz. */
export const WHISPER_SAMPLE_RATE = 16000;

// The recorder hands us floats in [-1, 1]; whisper's JSI binding divides the
// incoming integers by 32767, so that is the scale to multiply back up by.
const INT16_SCALE = 32767;

/**
 * Convert float samples to little-endian signed 16-bit bytes.
 *
 * Returned as bytes rather than an `Int16Array` because that is what
 * whisper.rn's `AudioStreamData.data` carries, and because a `Uint8Array` is
 * endian-explicit where a typed-array view would inherit the platform's.
 */
export function int16BytesFromFloat32(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    // Clamp before scaling: a sample slightly outside [-1, 1] would otherwise
    // wrap to the opposite sign and click audibly.
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, Math.round(clamped * INT16_SCALE), true);
  }
  return bytes;
}

/** Inverse of {@link int16BytesFromFloat32}, for playback and for tests. */
export function float32FromInt16Bytes(bytes: Uint8Array): Float32Array {
  const count = Math.floor(bytes.length / 2);
  const samples = new Float32Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < count; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / INT16_SCALE;
  }
  return samples;
}

/** Root-mean-square level of a buffer, in the same [0, 1] scale as the input. */
export function rmsOf(samples: Float32Array): number {
  if (!samples.length) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * RMS level per `hopMs` slice of audio.
 *
 * The orb needs to pulse in time with speech while the assistant talks. Rather
 * than tap the graph with an analyser at frame rate, we precompute the envelope
 * from the samples we already hold and walk it against the clock — deterministic
 * and testable, and it costs one pass over the buffer.
 */
export function envelopeOf(
  samples: Float32Array,
  sampleRate: number,
  hopMs: number,
): Float32Array {
  const hop = Math.max(1, Math.round((sampleRate * hopMs) / 1000));
  const slices = Math.ceil(samples.length / hop);
  const envelope = new Float32Array(slices);
  for (let slice = 0; slice < slices; slice += 1) {
    const start = slice * hop;
    envelope[slice] = rmsOf(samples.subarray(start, start + hop));
  }
  return envelope;
}

/**
 * Scale an RMS reading into the 0..1 range the orb animates over.
 *
 * Speech RMS sits well below 1 even when loud, so a linear mapping barely moves
 * the orb. This stretches the quiet end where the interesting variation is.
 */
export function normalizeLevel(rms: number, floor = 0.005, ceiling = 0.3) {
  if (rms <= floor) {
    return 0;
  }
  const span = Math.max(ceiling - floor, Number.EPSILON);
  const ratio = Math.min(1, (rms - floor) / span);
  return Math.sqrt(ratio);
}

/**
 * Resample mono float samples to a target rate.
 *
 * whisper.cpp only accepts 16 kHz and whisper.rn does no conversion of its own
 * — it treats the configured rate as a promise and does duration arithmetic
 * against it — so whatever the device hands us has to be converted here or the
 * transcript comes out garbled and mistimed.
 *
 * Integer ratios (the common 48 kHz -> 16 kHz case) average each group of
 * samples, which doubles as a crude anti-alias filter. Everything else falls
 * back to linear interpolation, which is more than enough for speech.
 */
export function resampleTo(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || !samples.length) {
    return samples;
  }

  const ratio = fromRate / toRate;

  if (Number.isInteger(ratio) && ratio > 1) {
    const factor = ratio;
    const count = Math.floor(samples.length / factor);
    const out = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      let sum = 0;
      const start = index * factor;
      for (let offset = 0; offset < factor; offset += 1) {
        sum += samples[start + offset];
      }
      out[index] = sum / factor;
    }
    return out;
  }

  const count = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    const weight = position - left;
    out[index] = samples[left] * (1 - weight) + samples[right] * weight;
  }
  return out;
}

/**
 * Mix per-channel buffers down to one by averaging them.
 *
 * `AudioBuffer` stores channels separately rather than interleaved, so this
 * takes the channel buffers as they come off `getChannelData`. The recorder is
 * asked for mono but the docs are explicit that the device may hand back more.
 */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) {
    return new Float32Array(0);
  }
  if (channels.length === 1) {
    return channels[0];
  }
  const frames = channels.reduce(
    (shortest, channel) => Math.min(shortest, channel.length),
    channels[0].length,
  );
  const out = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels.length; channel += 1) {
      sum += channels[channel][frame];
    }
    out[frame] = sum / channels.length;
  }
  return out;
}
