const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Xcode 16+/26 splits the Debug app build into a thin executable + a
 * `*.debug.dylib` (and a SwiftUI `__preview.dylib`) for faster incremental
 * builds. Once the app contains any first-party Swift (our local
 * `address-autocomplete` module is the first), the linker tries to link the
 * preview dylib directly against the private `SwiftUICore` framework and fails:
 *   "cannot link directly with 'SwiftUICore' because product being built is not
 *    an allowed client of it" -> ld: symbol(s) not found.
 *
 * This is a debug-only artifact (Release builds a single binary and is
 * unaffected, so TestFlight is fine), but it breaks `expo run:ios` dev builds.
 * Disabling the debug-dylib split reverts Debug to the old single-binary link,
 * which sidesteps the SwiftUICore client check. No effect on Release.
 *
 * `ios/` is generated (gitignored), so we set it via a config plugin that
 * re-applies on every prebuild.
 */
module.exports = function withDisableDebugDylib(config) {
  return withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings.ENABLE_DEBUG_DYLIB_SUPPORT = 'NO';
      }
    }
    return cfg;
  });
};
