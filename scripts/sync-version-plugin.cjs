/**
 * semantic-release plugin to sync VERSION file
 *
 * semantic-release updates package.json but not the VERSION file.
 * This plugin keeps VERSION in sync for shell scripts and installers.
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  /**
   * Called during the prepare step before git commit
   */
  prepare(_pluginConfig, context) {
    const { nextRelease, logger } = context;
    const versionFile = path.join(process.cwd(), 'VERSION');

    // Write version without 'v' prefix (e.g., "5.1.0" not "v5.1.0")
    const version = nextRelease.version;
    fs.writeFileSync(versionFile, version + '\n');
    logger.log('[sync-version-plugin] Updated VERSION file to %s', version);

    // Also update installers for standalone installs
    const installSh = path.join(process.cwd(), 'installers', 'install.sh');
    const installPs1 = path.join(process.cwd(), 'installers', 'install.ps1');

    if (fs.existsSync(installSh)) {
      let content = fs.readFileSync(installSh, 'utf8');
      content = content.replace(/^CCS_VERSION=".*"/m, `CCS_VERSION="${version}"`);
      fs.writeFileSync(installSh, content);
      logger.log('[sync-version-plugin] Updated installers/install.sh');
    }

    if (fs.existsSync(installPs1)) {
      let content = fs.readFileSync(installPs1, 'utf8');
      content = content.replace(/^\$CcsVersion = ".*"/m, `$CcsVersion = "${version}"`);
      fs.writeFileSync(installPs1, content);
      logger.log('[sync-version-plugin] Updated installers/install.ps1');
    }
  }
};
