// Ad-hoc sign macOS .app so Gatekeeper shows "unidentified developer"
// instead of the misleading "app is damaged" message for unsigned downloads.
// Skip when a real signing identity is configured (CSC_LINK / CSC_NAME).
// Proper fix long-term: Developer ID + notarization.

const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  console.log(`[after-pack] ad-hoc signing ${appPath}`);
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath],
    { stdio: 'inherit' }
  );
  execFileSync('codesign', ['--verify', '--verbose=1', appPath], { stdio: 'inherit' });
};
