const path = require('path');
const { remote } = require('electron');

// Get the correct base path whether in development or production
function getBasePath() {
    // When in development
    if (!remote.app.isPackaged) {
        return path.resolve('./');
    }

    // When in production
    return remote.app.getAppPath().replace('app.asar', '');
}

// Helper to get asset paths
function getAssetPath(assetPath) {
    return path.join(getBasePath(), 'assets', assetPath);
}

module.exports = {
    getBasePath,
    getAssetPath
};