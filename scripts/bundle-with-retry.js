const { spawnSync } = require('node:child_process');

// Worklets Bundle Mode emits node_modules/react-native-worklets/.worklets/<id>.js
// during transform — after Metro has built its file map — so a one-shot bundle
// fails with "Failed to get the SHA-1" on the first pass. Running the identical
// command again succeeds, because the files now exist.
//
// Gradle hardcodes --reset-cache, which makes the emitted ids differ on every
// run, so the retry would never converge. Dropping that flag makes the ids
// stable; Metro's transform cache is keyed on the transform config, so a release
// build still cannot pick up debug-transformed output.
const args = process.argv.slice(2).filter(arg => arg !== '--reset-cache');

const run = () =>
  spawnSync(process.execPath, args, { stdio: 'inherit' }).status ?? 1;

let status = run();

if (status !== 0) {
  console.log('\n[bundle-with-retry] retrying after worklet emission\n');
  status = run();
}

process.exit(status);
