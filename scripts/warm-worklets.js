const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workletsDir = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-worklets',
  '.worklets',
);

function isWarm() {
  try {
    return fs.readdirSync(workletsDir).some(f => f.endsWith('.js'));
  } catch {
    return false;
  }
}

if (isWarm()) {
  process.exit(0);
}

// The worklets Babel plugin writes .worklets/<id>.js during transform, after
// Metro has already built its file map, so the first bundle of a cold tree
// fails with "Failed to get the SHA-1". Ids are content-derived and shared
// across platforms and dev/release, so one throwaway bundle warms every build.
const out = path.join(os.tmpdir(), 'warm-worklets.bundle');

for (let attempt = 0; attempt < 2; attempt += 1) {
  try {
    execFileSync(
      'npx',
      [
        'react-native',
        'bundle',
        '--platform',
        'android',
        '--dev',
        'false',
        '--entry-file',
        'index.js',
        '--bundle-output',
        out,
      ],
      { cwd: path.join(__dirname, '..'), stdio: 'ignore' },
    );
    break;
  } catch {
    // First pass is expected to fail while it emits the worklet files.
  }
}

fs.rmSync(out, { force: true });
console.log(
  isWarm() ? 'worklets: warmed' : 'worklets: warm failed (release builds may fail)',
);
