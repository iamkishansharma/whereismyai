export function formatBytes(bytes: number): string {
  if (!bytes) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

export function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}

export function formatParams(paramCount?: number): string | undefined {
  if (!paramCount) {
    return undefined;
  }
  if (paramCount >= 1_000_000_000) {
    return `${(paramCount / 1_000_000_000).toFixed(paramCount >= 10e9 ? 0 : 1)}B`;
  }
  return `${Math.round(paramCount / 1_000_000)}M`;
}
