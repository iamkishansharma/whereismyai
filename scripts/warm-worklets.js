const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(os.tmpdir(), 'warm-worklets.bundle');
const workletsDir = path.join(
  root,
  'node_modules',
  'react-native-worklets',
  '.worklets',
);

// The plugin writes into this directory but does not create it. Without it every
// bundle fails on a missing worklet file and nothing is ever emitted to fix it,
// which is what made release builds look unfixably broken.
fs.mkdirSync(workletsDir, { recursive: true });

// The worklets Babel plugin writes .worklets/<id>.js during transform, after
// Metro has already built its file map, so a bundle of a cold tree fails with
// "Failed to get the SHA-1" while emitting those files. Each pass emits a few
// more until the set is complete, at which point bundling succeeds and keeps
// succeeding. Ids are shared across platforms and dev/release, so warming once
// here covers every later build.
//
// A dependency change invalidates Metro's transform cache and needs several
// passes, which is why this is a loop rather than a single retry.
const MAX_PASSES = 8;

function bundle(platform, resetCache) {
  const args = [
    'react-native',
    'bundle',
    '--platform',
    platform,
    '--dev',
    'false',
    '--entry-file',
    'index.js',
    '--bundle-output',
    out,
  ];
  if (resetCache) {
    args.push('--reset-cache');
  }

  try {
    execFileSync('npx', args, { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Most ids are shared, but each platform emits a few of its own, so warming
// only one leaves the other's first build to fail.
const warmed = ['android', 'ios'].every((platform, index) => {
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    // Only the very first pass resets: a stale transform cache can hold results
    // that reference already-deleted worklet files, and then the plugin never
    // re-runs to re-emit them.
    if (bundle(platform, index === 0 && pass === 0)) {
      return true;
    }
  }
  return false;
});

fs.rmSync(out, { force: true });
console.log(
  warmed
    ? 'worklets: warmed'
    : `worklets: not warm after ${MAX_PASSES} passes (release builds may fail)`,
);
