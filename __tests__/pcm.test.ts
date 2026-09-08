import {
  envelopeOf,
  float32FromInt16Bytes,
  int16BytesFromFloat32,
  normalizeLevel,
  resampleTo,
  mixToMono,
  rmsOf,
} from '@/core/audio/pcm';

const floats = (...values: number[]) => Float32Array.from(values);

describe('int16BytesFromFloat32', () => {
  it('writes two little-endian bytes per sample', () => {
    const bytes = int16BytesFromFloat32(floats(0, 1, -1));
    expect(bytes).toHaveLength(6);
    // 32767 = 0x7FFF, little-endian, and -32767 = 0x8001.
    expect(Array.from(bytes)).toEqual([0, 0, 0xff, 0x7f, 0x01, 0x80]);
  });

  it('clamps out-of-range samples instead of wrapping them', () => {
    const bytes = int16BytesFromFloat32(floats(1.5, -1.5));
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32767);
  });

  it('round-trips back to the original samples within quantisation error', () => {
    const original = floats(0, 0.25, -0.5, 0.75, -1);
    const restored = float32FromInt16Bytes(int16BytesFromFloat32(original));
    expect(restored).toHaveLength(original.length);
    original.forEach((value, index) => {
      expect(restored[index]).toBeCloseTo(value, 4);
    });
  });
});

describe('float32FromInt16Bytes', () => {
  it('ignores a trailing odd byte rather than reading past the buffer', () => {
    expect(float32FromInt16Bytes(new Uint8Array([0, 0, 0]))).toHaveLength(1);
  });

  it('respects the byte offset of a view into a larger buffer', () => {
    const backing = new Uint8Array([0xaa, 0xbb, 0xff, 0x7f]);
    const view = backing.subarray(2);
    expect(float32FromInt16Bytes(view)[0]).toBeCloseTo(1, 4);
  });
});

describe('rmsOf', () => {
  it('is zero for silence and for an empty buffer', () => {
    expect(rmsOf(floats(0, 0, 0))).toBe(0);
    expect(rmsOf(floats())).toBe(0);
  });

  it('is the magnitude of a constant signal', () => {
    expect(rmsOf(floats(0.5, -0.5, 0.5, -0.5))).toBeCloseTo(0.5, 6);
  });
});

describe('envelopeOf', () => {
  it('produces one reading per hop, including a short final slice', () => {
    // 1000 Hz with a 10 ms hop is 10 samples per slice; 25 samples is 3 slices.
    const envelope = envelopeOf(new Float32Array(25), 1000, 10);
    expect(envelope).toHaveLength(3);
  });

  it('tracks level changes across slices', () => {
    const samples = Float32Array.from([
      ...Array(10).fill(1),
      ...Array(10).fill(0),
    ]);
    const envelope = envelopeOf(samples, 1000, 10);
    expect(envelope[0]).toBeCloseTo(1, 6);
    expect(envelope[1]).toBeCloseTo(0, 6);
  });

  it('never divides by a zero-length hop', () => {
    expect(() => envelopeOf(floats(1, 1), 1000, 0)).not.toThrow();
  });
});

describe('normalizeLevel', () => {
  it('floors near-silence to zero', () => {
    expect(normalizeLevel(0)).toBe(0);
    expect(normalizeLevel(0.001)).toBe(0);
  });

  it('caps at one past the ceiling', () => {
    expect(normalizeLevel(0.9)).toBe(1);
  });

  it('rises faster than linearly so quiet speech still registers', () => {
    // Halfway up the range should sit above 0.5 thanks to the sqrt curve.
    const midpoint = normalizeLevel(0.005 + (0.3 - 0.005) / 2);
    expect(midpoint).toBeGreaterThan(0.5);
    expect(midpoint).toBeLessThan(1);
  });
});

describe('resampleTo', () => {
  it('returns the input untouched when the rate already matches', () => {
    const samples = floats(0.1, 0.2);
    expect(resampleTo(samples, 16000, 16000)).toBe(samples);
  });

  it('averages groups when downsampling by an integer factor', () => {
    // 48k -> 16k is a factor of 3, so each output is the mean of three inputs.
    const out = resampleTo(floats(0, 0.3, 0.6, 1, 1, 1), 48000, 16000);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeCloseTo(0.3, 6);
    expect(out[1]).toBeCloseTo(1, 6);
  });

  it('interpolates for non-integer ratios', () => {
    // 44.1k -> 16k is ~2.75625, which cannot be a clean group average.
    const out = resampleTo(
      Float32Array.from({ length: 441 }, (_, i) => i / 441),
      44100,
      16000,
    );
    expect(out).toHaveLength(160);
    expect(out[0]).toBeCloseTo(0, 6);
    // Monotonic ramp in, monotonic ramp out.
    expect(out[159]).toBeGreaterThan(out[0]);
  });

  it('handles an empty buffer without dividing by zero', () => {
    expect(resampleTo(floats(), 48000, 16000)).toHaveLength(0);
  });
});

describe('mixToMono', () => {
  it('returns the single channel untouched', () => {
    const samples = floats(0.1, 0.2);
    expect(mixToMono([samples])).toBe(samples);
  });

  it('averages matching channels', () => {
    const out = mixToMono([floats(0, 0.5), floats(1, 0.5)]);
    expect(Array.from(out)).toEqual([0.5, 0.5]);
  });

  it('truncates to the shortest channel rather than reading past it', () => {
    expect(mixToMono([floats(0, 1, 1), floats(1, 0)])).toHaveLength(2);
  });

  it('handles no channels at all', () => {
    expect(mixToMono([])).toHaveLength(0);
  });
});
