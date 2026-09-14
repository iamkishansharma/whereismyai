const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { dirname, join } = require('node:path');

// Worklets Bundle Mode emits node_modules/react-native-worklets/.worklets/<id>.js
// during transform — after Metro has built its file map — so the first bundle of
// a clean checkout fails with "Failed to get the SHA-1". Running the identical
// command again succeeds, because the files now exist.
//
// Gradle hardcodes --reset-cache, which makes the emitted ids differ on every
// run, so the retry would never converge. Dropping that flag makes the ids
// stable; Metro's transform cache is keyed on the transform config, so a release
// build still cannot pick up debug-transformed output.
const args = process.argv.slice(2).filter(arg => arg !== '--reset-cache');

// Two callers, two shapes. Gradle passes this as the node executable, so it
// receives the CLI path itself. Xcode passes it as CLI_PATH, so it receives a
// bare command such as "bundle" and the real CLI has to be filled in.
if (args.length && !existsSync(args[0])) {
  // Resolved via package.json: react-native's "exports" map does not expose
  // scripts/bundle.js, so requiring it by path fails.
  const reactNativeDir = dirname(require.resolve('react-native/package.json'));
  args.unshift(join(reactNativeDir, 'scripts', 'bundle.js'));
}

const run = () =>
  spawnSync(process.execPath, args, { stdio: 'inherit' }).status ?? 1;

// Each pass emits a few more worklet files; a tree whose dependencies just
// changed needs several before the set is complete. `yarn warm:worklets` runs
// in postinstall so this usually succeeds first time.
const MAX_PASSES = 4;

let status = 1;
for (let pass = 0; pass < MAX_PASSES; pass += 1) {
  if (pass > 0) {
    console.log(
      `\n[bundle-with-retry] pass ${pass + 1} after worklet emission\n`,
    );
  }
  status = run();
  if (status === 0) {
    break;
  }
}

process.exit(status);
