// Debug builds for a physical device sign with the explicit "Organizard Development"
// profile. Xcode's automatic signing falls back to the team wildcard profile, which
// cannot carry the Sign in with Apple entitlement, so `expo run:ios --device` fails
// without this. Release stays automatic (EAS local builds bring their own credentials)
// and simulator builds ignore provisioning entirely.
const { withXcodeProject } = require('@expo/config-plugins');

const PROFILE = 'Organizard Development';
const TEAM = '2JQ4YYA99A';

module.exports = function withDevSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configs = project.pbxXCBuildConfigurationSection();
    for (const [, entry] of Object.entries(configs)) {
      if (!entry || typeof entry !== 'object' || entry.name !== 'Debug') continue;
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
