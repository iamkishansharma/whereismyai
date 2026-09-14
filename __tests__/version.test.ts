import appJson from '../app.json';
import packageJson from '../package.json';

describe('version', () => {
  it('app.json matches package.json', () => {
    // The drawer shows app.json's value; releases are cut from package.json.
    // If these drift, the app reports a version that was never published.
    expect(appJson.version).toBe(packageJson.version);
  });

  it('is a plain semver triple', () => {
    // iOS CFBundleShortVersionString and Android versionName both reject
    // pre-release suffixes, so the shared value has to stay x.y.z.
    expect(appJson.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
