// Device builds made with `expo run:ios --device` (Debug or Release) sign with the
// explicit "Organizard Development" profile. Xcode's automatic signing falls back to
// the team wildcard profile, which cannot carry the Sign in with Apple entitlement.
// EAS/TestFlight builds override these settings with the distribution credentials in
// credentials.json, and simulator builds ignore provisioning entirely.
const { withXcodeProject } = require('@expo/config-plugins');

const PROFILE = 'Organizard Development';
const TEAM = '2JQ4YYA99A';

module.exports = function withDevSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configs = project.pbxXCBuildConfigurationSection();
    for (const [, entry] of Object.entries(configs)) {
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;
      const s = entry.buildSettings;
      if (!s || s.PRODUCT_BUNDLE_IDENTIFIER !== 'com.organizard.app') continue;
      s.CODE_SIGN_STYLE = 'Manual';
      s.DEVELOPMENT_TEAM = TEAM;
      s.CODE_SIGN_IDENTITY = '"Apple Development"';
      s.PROVISIONING_PROFILE_SPECIFIER = `"${PROFILE}"`;
    }
    return cfg;
  });
};
