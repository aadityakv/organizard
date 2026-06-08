const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * fmt 11.0.2 (pinned by React Native 0.76) fails to compile under Xcode 26 /
 * newer Apple clang: it enables `consteval` for any Apple clang >= 14, but this
 * toolchain enforces consteval more strictly than fmt 11.0.2's code satisfies,
 * so `Pods/fmt/include/fmt/base.h` -> format-inl.h fails with
 * "call to consteval function ... is not a constant expression".
 *
 * Upstream fmt fixed this in later releases. Until RN bumps fmt, we force fmt to
 * treat all Apple clang as "consteval broken" (FMT_USE_CONSTEVAL 0), which turns
 * the offending constructors into ordinary functions. We inject the patch into
 * the Podfile's post_install so it re-applies every `pod install` / `prebuild`,
 * because `ios/` is generated (gitignored) and not hand-edited.
 */
const MARKER = '[organizard] fmt consteval fix';
const ANCHOR = 'post_install do |installer|';
const INJECTED = `post_install do |installer|
    # ${MARKER}: make fmt 11.0.2 build on Xcode 26 / newer Apple clang.
    fmt_base = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      txt = File.read(fmt_base)
      fixed = txt.gsub(
        '#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L',
        '#elif defined(__apple_build_version__)'
      )
      File.write(fmt_base, fixed) if fixed != txt
    end`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER) && contents.includes(ANCHOR)) {
        contents = contents.replace(ANCHOR, INJECTED);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
