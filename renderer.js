const { ipcRenderer } = require('electron');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Constants

const LARGE_MOD_FILENAME = 'Cobblemon-neoforge-1.6.1+1.21.1.jar';

// Constants
const REPO_URL = 'https://github.com/gisketch/ckdm-mods.git';
// Local file paths for mod links and potato mode disabled mods
const LARGE_MODS_FILE_PATH = 'syncerData/large_mods.txt';
const POTATO_DISABLED_MODS_FILE_PATH = 'syncerData/potato_disabled.txt';
const SHADER_SETTINGS_FILE_PATH = 'syncerData/shader_settings.txt';
const OTHER_MODS_PASTEBIN_URL = 'https://pastebin.com/raw/79Ye5xpB'; // Replace with actual pastebin ID

// Tracked folders and files
const TRACKED_PATHS = [
    'config',
    'resourcepacks',
    'shaderpacks',
    'mods',
    'potato',
    'syncerData',
    'kubejs',
    'keybind_bundles.json',
    'options.txt'
];

// UI elements
const browseBtn = document.getElementById('browse-btn');
const syncBtn = document.getElementById('sync-btn');
const statusMessage = document.getElementById('status-message');
const folderPathDisplay = document.getElementById('folder-path');
const syncConfigsCheckbox = document.getElementById('sync-configs');
const syncKeybindsCheckbox = document.getElementById('sync-keybinds');
const disableClientModsCheckbox = document.getElementById('disable-client-mods');
const shaderOffRadio = document.getElementById('shader-off');
const shaderPotatoRadio = document.getElementById('shader-potato');
const shaderDefaultRadio = document.getElementById('shader-default');
const shaderDontSyncRadio = document.getElementById('shader-dont-sync');
const otherModsContainer = document.getElementById('other-mods-container');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const syncLogContainer = document.getElementById('sync-log-container');
const syncLog = document.getElementById('sync-log');

// Store selected paths
let selectedInstancePath = null;
// Store keybinds backup
let keybindsBackup = {};
// Store iris.properties backup
let irisPropertiesBackup = null;
// Store other mods data
let otherModsData = {};


// Initialize the Others section with a message
document.addEventListener('DOMContentLoaded', () => {
    if (otherModsContainer) {
        otherModsContainer.innerHTML = '<p class="info-message">Select a Minecraft instance folder to load available mods.</p>';
    }

    // Check for updates when the app starts
    checkForUpdates();
});

// Check for updates by comparing version numbers
async function checkForUpdates() {
    try {
        // We'll check for updates only if an instance is selected
        if (!selectedInstancePath) return;

        // Path to local version file
        const localVersionPath = path.join(selectedInstancePath, 'syncerData', 'version.txt');
        let currentVersion = null;

        // Check if local version file exists
        if (await fs.pathExists(localVersionPath)) {
            currentVersion = (await fs.readFile(localVersionPath, 'utf8')).trim();
        }

        // Fetch remote version
        const remoteVersionUrl = 'https://raw.githubusercontent.com/gisketch/ckdm-mods/refs/heads/main/syncerData/version.txt';
        const response = await axios.get(remoteVersionUrl);
        const remoteVersion = response.data.trim();

        // If local version doesn't exist or is different from remote, show changelog
        if (!currentVersion || currentVersion !== remoteVersion) {
            showChangelog();
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

// Show changelog in a new window
async function showChangelog() {
    try {
        // Fetch changelog content
        const changelogUrl = 'https://raw.githubusercontent.com/gisketch/ckdm-mods/refs/heads/main/syncerData/update.md';
        const response = await axios.get(changelogUrl);
        const changelogContent = response.data;

        // Fetch remote version for title
        const remoteVersionUrl = 'https://raw.githubusercontent.com/gisketch/ckdm-mods/refs/heads/main/syncerData/version.txt';
        const versionResponse = await axios.get(remoteVersionUrl);
        const versionNumber = versionResponse.data.trim();

        // Create a new window to display the changelog
        const changelogWindow = window.open('', 'Changelog', 'width=800,height=600');

        // Add content to the window
        changelogWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>Chowkingdom v${versionNumber} - Changelog</title>
                <style>
                    @font-face {
                        font-family: 'Minecraft';
                        src: url('assets/fonts/Minecraft.ttf') format('truetype');
                    }
                    
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        margin: 0;
                        padding: 0;
                        background-image: url('assets/images/bg.png');
                        background-size: cover;
                        background-attachment: fixed;
                        color: #f0f0f0;
                        min-height: 100vh;
                    }
                    
                    .container {
                        max-width: 800px;
                        margin: 20px auto;
                        background-color: rgba(32, 32, 32, 0.9);
                        padding: 20px;
                        border-radius: 5px;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
                    }
                    
                    .header {
                        display: flex;
                        align-items: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #ff9e36;
                        padding-bottom: 10px;
                    }
                    
                    .title h1 {
                        color: #ff9e36;
                        margin: 0;
                        font-family: 'Minecraft', Arial, sans-serif;
                    }
                    
                    h2 {
                        color: #ff9e36;
                        margin-top: 20px;
                        font-family: 'Minecraft', Arial, sans-serif;
                    }
                    
                    ul {
                        padding-left: 20px;
                    }
                    
                    li {
                        margin-bottom: 5px;
                    }
                    
                    code {
                        background-color: #333;
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                    
                    pre {
                        background-color: #333;
                        padding: 10px;
                        border-radius: 3px;
                        overflow-x: auto;
                    }
                    
                    .close-btn {
                        display: block;
                        margin: 20px auto 0;
                        padding: 10px 20px;
                        background-color: #ff9e36;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        font-family: 'Minecraft', Arial, sans-serif;
                    }
                    
                    .close-btn:hover {
                        background-color: #e88f2a;
                    }
                    
                    .information {
                        margin-top: 20px;
                        font-size: 0.9em;
                        color: #888;
                        text-align: center;
                    }
                </style>
                <!-- Include marked.js for Markdown rendering -->
                <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="title">
                            <h1>Chowkingdom v${versionNumber}</h1>
                            <p>Changelog</p>
                        </div>
                    </div>
                    <div id="changelog-content"></div>
                    <button class="close-btn" onclick="window.close()">Close</button>
                    <div class="information">
                        <p>Developed by @gisketch</p>
                    </div>
                </div>
                <script>
                    // Render markdown content
                    document.getElementById('changelog-content').innerHTML = marked.parse(\`${changelogContent.replace(/`/g, '\\`')}\`);
                </script>
            </body>
            </html>
        `);

        // Close the document to finish writing
        changelogWindow.document.close();
    } catch (error) {
        console.error('Error showing changelog:', error);
    }
}

if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
        const folderData = await ipcRenderer.invoke('select-folder');

        if (folderData) {
            selectedInstancePath = folderData.path;
            if (folderPathDisplay) folderPathDisplay.textContent = `Instance folder: ${selectedInstancePath}`;

            if (folderData.isValidInstance) {
                if (statusMessage) statusMessage.textContent = 'Minecraft instance folder detected! Ready to sync.';
                if (syncBtn) syncBtn.disabled = false;

                // Load other mods data
                await loadOtherModsData();

                // Check for updates after selecting a valid instance
                await checkForUpdates();
            } else {
                if (statusMessage) statusMessage.textContent = 'Selected folder does not appear to be a valid Minecraft instance.';
                if (syncBtn) syncBtn.disabled = true;
            }
        }
    });
}


// Load other mods data from pastebin
async function loadOtherModsData() {
    try {
        // First try to load from the repository if it exists
        const otherModsFilePath = path.join(selectedInstancePath, 'syncerData', 'other_mods.txt');

        if (await fs.pathExists(otherModsFilePath)) {
            const content = await fs.readFile(otherModsFilePath, 'utf8');
            parseOtherModsData(content);
        } else {
            // If not found locally, try to fetch from pastebin
            const response = await axios.get(OTHER_MODS_PASTEBIN_URL);
            if (response.status === 200) {
                parseOtherModsData(response.data);
            }
        }
    } catch (error) {
        logMessage(`Error loading other mods data: ${error.message}`, 'error');
    }
}


// Parse other mods data and create UI elements
function parseOtherModsData(content) {
    otherModsData = {};
    otherModsContainer.innerHTML = '';

    const lines = content.split('\n');
    for (const line of lines) {
        if (line.trim() && line.includes('=')) {
            const [displayName, modPattern] = line.split('=').map(part => part.trim());
            otherModsData[displayName] = modPattern;

            // Create checkbox for this mod
            const checkboxId = `mod-${displayName.replace(/\s+/g, '-').toLowerCase()}`;

            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'option-row';

            const label = document.createElement('label');
            label.className = 'checkbox-container';
            label.textContent = `Enable ${displayName}`;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = checkboxId;
            input.dataset.modName = displayName;

            const span = document.createElement('span');
            span.className = 'checkmark';

            label.prepend(input);
            label.appendChild(span);
            checkboxContainer.appendChild(label);
            otherModsContainer.appendChild(checkboxContainer);

            // Check if mod is currently enabled
            checkModStatus(displayName, modPattern, input);
        }
    }
}


// Check if a mod is currently enabled or disabled
async function checkModStatus(displayName, modPattern, checkbox) {
    try {
        if (!selectedInstancePath) return;

        const modsDir = path.join(selectedInstancePath, 'mods');
        if (!await fs.pathExists(modsDir)) return;

        const files = await fs.readdir(modsDir);

        // Create a regex pattern from the wildcard pattern
        const regexPattern = new RegExp('^' + modPattern.replace(/\*/g, '.*') + '\\.(jar|disabled)$');

        // Find matching files
        const matchingFiles = files.filter(file => regexPattern.test(file));

        if (matchingFiles.length > 0) {
            // Check if any matching file is enabled (ends with .jar)
            const isEnabled = matchingFiles.some(file => file.endsWith('.jar'));
            checkbox.checked = isEnabled;
        }
    } catch (error) {
        logMessage(`Error checking mod status: ${error.message}`, 'error');
    }
}


if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
        try {
            // Disable UI during sync
            if (syncBtn) syncBtn.disabled = true;
            if (browseBtn) browseBtn.disabled = true;
            if (statusMessage) statusMessage.textContent = 'Syncing modpack... Please wait.';

            // Show progress and log containers
            if (progressContainer) progressContainer.style.display = 'block';
            if (syncLogContainer) syncLogContainer.style.display = 'block';
            if (syncLog) syncLog.innerHTML = '';

            // Get options
            const syncConfigs = syncConfigsCheckbox ? syncConfigsCheckbox.checked : false;
            const syncKeybinds = syncKeybindsCheckbox ? syncKeybindsCheckbox.checked : false;
            const disableClientMods = disableClientModsCheckbox ? disableClientModsCheckbox.checked : false;

            // Get shader settings
            let shaderSetting = 'default';
            if (shaderOffRadio && shaderOffRadio.checked) shaderSetting = 'off';
            else if (shaderPotatoRadio && shaderPotatoRadio.checked) shaderSetting = 'potato';
            else if (shaderDefaultRadio && shaderDefaultRadio.checked) shaderSetting = 'default';
            else if (shaderDontSyncRadio && shaderDontSyncRadio.checked) shaderSetting = 'dont-sync';

            // Get other mods settings
            const otherModsSettings = {};
            const otherModsCheckboxes = document.querySelectorAll('#other-mods-container input[type="checkbox"]');
            otherModsCheckboxes.forEach(checkbox => {
                otherModsSettings[checkbox.dataset.modName] = checkbox.checked;
            });

            // Backup keybinds before any operations if we're not syncing them
            if (!syncKeybinds) {
                await backupKeybinds();
            }

            // Backup iris.properties if we're using "Don't Sync" option
            if (shaderSetting === 'dont-sync') {
                await backupIrisProperties();
            }

            // Start sync process
            await syncModpack(syncConfigs, syncKeybinds, shaderSetting, disableClientMods, otherModsSettings);

            // Update UI after completion
            if (statusMessage) statusMessage.textContent = 'Modpack successfully synced!';
            setProgress(100, 'Completed!');
        } catch (error) {
            logMessage(`ERROR: ${error.message}`, 'error');
            if (statusMessage) statusMessage.textContent = 'Error syncing modpack. See log for details.';
            setProgress(0, 'Failed');
            console.error('Sync error:', error);
        } finally {
            // Re-enable UI
            if (syncBtn) syncBtn.disabled = false;
            if (browseBtn) browseBtn.disabled = false;
        }
    });
}


// Backup iris.properties file
async function backupIrisProperties() {
    try {
        const irisPropertiesPath = path.join(selectedInstancePath, 'config', 'iris.properties');
        if (await fs.pathExists(irisPropertiesPath)) {
            irisPropertiesBackup = await fs.readFile(irisPropertiesPath, 'utf8');
            logMessage('Iris properties backed up.');
        }
    } catch (error) {
        logMessage(`Error backing up iris.properties: ${error.message}`, 'error');
    }
}

// Restore iris.properties file
async function restoreIrisProperties() {
    try {
        if (irisPropertiesBackup) {
            const irisPropertiesPath = path.join(selectedInstancePath, 'config', 'iris.properties');
            await fs.ensureDir(path.dirname(irisPropertiesPath));
            await fs.writeFile(irisPropertiesPath, irisPropertiesBackup);
            logMessage('Iris properties restored.');
        }
    } catch (error) {
        logMessage(`Error restoring iris.properties: ${error.message}`, 'error');
    }
}


async function syncModpack(syncConfigs, syncKeybinds, shaderSetting, disableClientMods, otherModsSettings) {
    try {
        // Step 1: Setup git repository
        setProgress(10, 'Setting up repository...');
        await setupGitRepository();

        // Step 2: Get paths before sync for comparison
        const beforeFiles = await getAllModFiles();

        // // Step 3: Sync all tracked folders and files
        // setProgress(30, 'Syncing from repository...');
        // await syncFromRepository();

        // Step 4: Restore keybinds immediately after sync if not syncing keybinds
        if (!syncKeybinds) {
            await restoreKeybinds();
        }

        // // Step 5: Download and install large mod files from pastebin
        // setProgress(60, 'Downloading large mod files...');
        // await downloadLargeMods();

        // Step 6: Get paths after sync for comparison
        const afterFiles = await getAllModFiles();

        // Step 7: Handle configs if needed
        setProgress(80, 'Applying settings...');
        if (syncConfigs) {
            // Apply config settings (old potato profile functionality)
            await applyConfigSettings(syncKeybinds);

            // Restore keybinds again after config application if needed
            if (!syncKeybinds) {
                await restoreKeybinds();
            }
        }

        // Step 8: Handle shader settings
        await applyShaderSettings(shaderSetting);

        // Step 9: If disableClientMods is enabled, disable specified mods
        if (disableClientMods) {
            await disablePotatoMods();
        }

        // Step 10: Handle other mods settings
        await handleOtherMods(otherModsSettings);

        // Step 11: Calculate changes for reporting
        const { added, removed, updated } = compareFiles(beforeFiles, afterFiles);

        // Report changes
        logMessage('Sync completed successfully!');

        if (added.length > 0) {
            logMessage(`Added: ${added.length} files`);
            added.forEach(file => logMessage(`  + ${file}`, 'added'));
        }

        if (updated.length > 0) {
            logMessage(`Updated: ${updated.length} files`);
            updated.forEach(update => logMessage(`  ~ ${update.from} → ${update.to}`, 'updated'));
        }

        if (removed.length > 0) {
            logMessage(`Removed: ${removed.length} files`);
            removed.forEach(file => logMessage(`  - ${file}`, 'removed'));
        }

        setProgress(100, 'Sync completed!');
    } catch (error) {
        logMessage(`Error during sync: ${error.message}`, 'error');
        throw error;
    }
}


// Apply config settings (replaces the old applySettingsProfile function)
async function applyConfigSettings(syncKeybinds) {
    try {
        logMessage('Applying config settings...');

        // If not syncing keybinds, restore them
        if (!syncKeybinds) {
            await preserveKeybinds();
        }

        logMessage('Config settings applied.');
    } catch (error) {
        logMessage(`Error applying config settings: ${error.message}`, 'error');
        throw error;
    }
}

// Apply shader settings based on selection
async function applyShaderSettings(shaderSetting) {
    try {
        logMessage(`Applying shader settings: ${shaderSetting}...`);

        // If "Don't Sync" is selected, restore the backed up iris.properties
        if (shaderSetting === 'dont-sync') {
            await restoreIrisProperties();
            return;
        }

        // Get shader settings from file
        const shaderSettingsPath = path.join(selectedInstancePath, SHADER_SETTINGS_FILE_PATH);
        let potatoName = '';
        let defaultName = '';

        if (await fs.pathExists(shaderSettingsPath)) {
            const content = await fs.readFile(shaderSettingsPath, 'utf8');
            const lines = content.split('\n');

            for (const line of lines) {
                if (line.startsWith('potato_name=')) {
                    potatoName = line.substring('potato_name='.length).trim();
                } else if (line.startsWith('default_name=')) {
                    defaultName = line.substring('default_name='.length).trim();
                }
            }
        }

        // Path to iris.properties
        const irisPropertiesPath = path.join(selectedInstancePath, 'config', 'iris.properties');

        // Ensure config directory exists
        await fs.ensureDir(path.dirname(irisPropertiesPath));

        // If iris.properties doesn't exist, create a default one
        if (!await fs.pathExists(irisPropertiesPath)) {
            const defaultContent =
                `#This file stores configuration options for Iris, such as the currently active shaderpack
#${new Date().toString()}
allowUnknownShaders=false
colorSpace=SRGB
disableUpdateMessage=false
enableDebugOptions=false
enableShaders=true
maxShadowRenderDistance=8
shaderPack=${defaultName}`;
            await fs.writeFile(irisPropertiesPath, defaultContent);
        }

        // Read current iris.properties
        const content = await fs.readFile(irisPropertiesPath, 'utf8');
        const lines = content.split('\n');
        const newLines = [];

        // Process each line
        for (const line of lines) {
            if (line.startsWith('enableShaders=')) {
                // If shader setting is "off", set enableShaders to false
                if (shaderSetting === 'off') {
                    newLines.push('enableShaders=false');
                } else {
                    newLines.push('enableShaders=true');
                }
            } else if (line.startsWith('shaderPack=')) {
                // Set shader pack based on setting
                if (shaderSetting === 'potato' && potatoName) {
                    newLines.push(`shaderPack=${potatoName}`);
                } else if (shaderSetting === 'default' && defaultName) {
                    newLines.push(`shaderPack=${defaultName}`);
                } else if (shaderSetting === 'off') {
                    // When turning off shaders, keep the current pack but disable it
                    newLines.push(line);
                } else {
                    // Default fallback
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        // Write updated iris.properties
        await fs.writeFile(irisPropertiesPath, newLines.join('\n'));
        logMessage(`Shader settings applied: ${shaderSetting}`);
    } catch (error) {
        logMessage(`Error applying shader settings: ${error.message}`, 'error');
        throw error;
    }
}

// Handle other mods (enable/disable based on settings)
async function handleOtherMods(otherModsSettings) {
    try {
        logMessage('Handling other mods settings...');

        const modsDir = path.join(selectedInstancePath, 'mods');
        if (!await fs.pathExists(modsDir)) {
            logMessage('Mods directory not found, skipping other mods handling.', 'warning');
            return;
        }

        const files = await fs.readdir(modsDir);

        // Process each mod in otherModsSettings
        for (const [displayName, enabled] of Object.entries(otherModsSettings)) {
            const modPattern = otherModsData[displayName];
            if (!modPattern) continue;

            // Create a regex pattern from the wildcard pattern
            const regexPattern = new RegExp('^' + modPattern.replace(/\*/g, '.*') + '\\.(jar|disabled)$');

            // Find matching files
            const matchingFiles = files.filter(file => regexPattern.test(file));

            for (const file of matchingFiles) {
                const filePath = path.join(modsDir, file);

                if (enabled) {
                    // Enable the mod (ensure it ends with .jar)
                    if (file.endsWith('.disabled')) {
                        const newPath = filePath.replace(/\.disabled$/, '.jar');
                        await fs.rename(filePath, newPath);
                        logMessage(`Enabled mod: ${file} → ${path.basename(newPath)}`, 'added');
                    }
                } else {
                    // Disable the mod (ensure it ends with .jar.disabled)
                    if (file.endsWith('.jar')) {
                        const newPath = `${filePath}.disabled`;
                        await fs.rename(filePath, newPath);
                        logMessage(`Disabled mod: ${file} → ${path.basename(newPath)}`, 'removed');
                    }
                }
            }
        }

        logMessage('Other mods settings applied.');
    } catch (error) {
        logMessage(`Error handling other mods: ${error.message}`, 'error');
        throw error;
    }
}

// Setup Git repository
async function setupGitRepository() {
    try {
        // Check if git already initialized
        const isGit = await fs.pathExists(path.join(selectedInstancePath, '.git'));

        if (!isGit) {
            logMessage('Initializing new git repository...');

            // Initialize git repository
            await git.init({ fs, dir: selectedInstancePath });

            // Create a .gitignore file to ignore everything except our tracked paths
            await createGitIgnore();

            // Add the remote
            await git.addRemote({
                fs,
                dir: selectedInstancePath,
                remote: 'origin',
                url: REPO_URL
            });

            logMessage('Git repository initialized with remote origin.');
        } else {
            logMessage('Using existing git repository.');

            // Make sure the remote is correct
            try {
                const remotes = await git.listRemotes({ fs, dir: selectedInstancePath });
                const hasOrigin = remotes.some(r => r.remote === 'origin');

                if (hasOrigin) {
                    // Update the URL just to be sure
                    await git.deleteRemote({ fs, dir: selectedInstancePath, remote: 'origin' });
                }
            } catch (e) {
                // If there's an error, continue anyway
            }

            // Add or update the remote
            await git.addRemote({
                fs,
                dir: selectedInstancePath,
                remote: 'origin',
                url: REPO_URL
            });

            logMessage('Git remote updated.');
        }

        // Make sure the gitignore is up to date
        await createGitIgnore();

    } catch (error) {
        logMessage(`Error setting up git repository: ${error.message}`, 'error');
        throw error;
    }
}


async function createGitIgnore() {
    const gitignorePath = path.join(selectedInstancePath, '.gitignore');

    // Start with ignoring everything
    let content = '# Ignore everything\n*\n\n';

    // Then allow the specific folders and files we want to track
    content += '# Except these folders and files\n';

    for (const trackedPath of TRACKED_PATHS) {
        content += `!${trackedPath}\n`;

        // If it's a folder, make sure all contents are included
        if (trackedPath !== 'options.txt') {
            content += `!${trackedPath}/**\n`;
        }
    }

    // Add specific ignores for large mod files
    content += '\n# Ignore large mod files\n';

    try {
        // Read the list of large mod URLs from local file
        const largeModsFilePath = path.join(selectedInstancePath, LARGE_MODS_FILE_PATH);

        if (await fs.pathExists(largeModsFilePath)) {
            const modLinksContent = await fs.readFile(largeModsFilePath, 'utf8');
            const modLinks = modLinksContent.split('\n').filter(line => line.trim());

            for (const modUrl of modLinks) {
                if (modUrl.trim()) {
                    // Extract filename from URL
                    const urlParts = modUrl.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    content += `mods/${fileName}\n`;
                }
            }
        } else {
            // Fallback to the hardcoded filename if file doesn't exist
            content += `mods/${LARGE_MOD_FILENAME}\n`;
        }
    } catch (error) {
        // Fallback to the hardcoded filename if reading fails
        content += `mods/${LARGE_MOD_FILENAME}\n`;
        logMessage(`Warning: Could not read mod list for gitignore: ${error.message}`, 'warning');
    }

    // Write the gitignore file
    await fs.writeFile(gitignorePath, content);
    logMessage('.gitignore file created/updated.');
}

// Helper function to format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'Unknown';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Sync files from the repository
async function syncFromRepository() {
    try {
        logMessage('Fetching latest changes from remote repository...');

        // Fetch from remote with progress events but without excessive logging
        await git.fetch({
            fs,
            http,
            dir: selectedInstancePath,
            remote: 'origin',
            depth: 1,
            singleBranch: true,
            ref: 'main',
            onProgress: event => {
                // Calculate progress percentage based on loaded/total
                const { loaded, total } = event;
                const percent = total ? Math.round((loaded / total) * 100) : 0;

                // Update progress bar with fetch status
                setProgress(30 * (percent / 100), `Fetching repo... this might take a while`);
            }
        });


        // Delete tracked folders and files first to ensure clean state
        // This ensures old files not in the repo anymore will be removed
        for (const trackedPath of TRACKED_PATHS) {
            const fullPath = path.join(selectedInstancePath, trackedPath);
            if (await fs.pathExists(fullPath)) {
                if (trackedPath === 'mods') {
                    // For mods folder, we need to be more careful
                    // We'll delete everything except .disabled files
                    const modsFiles = await fs.readdir(fullPath);
                    for (const file of modsFiles) {
                        if (!file.endsWith('.disabled')) {
                            await fs.remove(path.join(fullPath, file));
                        }
                    }
                } else {
                    await fs.remove(fullPath);
                }
            }
        }

        // Try to reset to main first, if that fails try master
        try {
            logMessage('Resetting to latest version from remote...');
            await git.checkout({
                fs,
                dir: selectedInstancePath,
                ref: 'origin/main',
                force: true
            });
            logMessage('Reset to origin/main successful.');
        } catch (mainError) {
            try {
                // Try master if main fails
                await git.checkout({
                    fs,
                    dir: selectedInstancePath,
                    ref: 'origin/master',
                    force: true
                });
                logMessage('Reset to origin/master successful.');
            } catch (masterError) {
                // Try a more direct approach
                logMessage('Standard checkout failed, trying alternative approach...');
                await resetToLatestCommit();
            }
        }

        logMessage('Repository sync completed.');
    } catch (error) {
        logMessage(`Error syncing from repository: ${error.message}`, 'error');
        throw error;
    }
}


// More direct approach to reset to the latest commit
async function resetToLatestCommit() {
    try {
        // Get the list of refs from the server
        const refs = await git.listServerRefs({
            fs,
            http,
            dir: selectedInstancePath,
            remote: 'origin'
        });

        // Find the HEAD ref for main or master
        const headRef = refs.find(ref => ref.ref === 'refs/heads/main') ||
            refs.find(ref => ref.ref === 'refs/heads/master');

        if (!headRef) {
            throw new Error('Could not find main or master branch on remote');
        }

        // Reset the working directory to match the remote
        logMessage(`Resetting to commit ${headRef.oid.slice(0, 7)}...`);

        // Delete tracked folders and files first to ensure clean state
        for (const trackedPath of TRACKED_PATHS) {
            const fullPath = path.join(selectedInstancePath, trackedPath);
            if (await fs.pathExists(fullPath)) {
                await fs.remove(fullPath);
            }
        }

        // Create a temporary branch pointing to the remote HEAD
        await git.writeRef({
            fs,
            dir: selectedInstancePath,
            ref: 'refs/heads/temp-sync',
            value: headRef.oid,
            force: true
        });

        // Check out the temporary branch
        await git.checkout({
            fs,
            dir: selectedInstancePath,
            ref: 'temp-sync',
            force: true
        });

        // Reset any staged or unstaged changes
        await git.clean({ fs, dir: selectedInstancePath, force: true });

        logMessage('Reset to latest remote commit successful.');
    } catch (error) {
        logMessage(`Error during alternative reset: ${error.message}`, 'error');
        throw error;
    }
}


async function backupKeybinds() {
    try {
        logMessage('Backing up keybinds...');
        const optionsPath = path.join(selectedInstancePath, 'options.txt');

        if (await fs.pathExists(optionsPath)) {
            const content = await fs.readFile(optionsPath, 'utf8');
            const lines = content.split('\n');

            // Extract keybinds
            keybindsBackup = {};
            for (const line of lines) {
                if (line.startsWith('key_')) {
                    const separatorIndex = line.indexOf(':');
                    if (separatorIndex !== -1) {
                        const key = line.substring(0, separatorIndex);
                        const value = line.substring(separatorIndex + 1);
                        keybindsBackup[key] = value;
                    }
                }
            }
            logMessage('Keybinds backed up.');
        } else {
            logMessage('options.txt not found, cannot backup keybinds.', 'warning');
        }

        // Also backup iris.properties
        await backupIrisProperties();
    } catch (error) {
        logMessage(`Error backing up keybinds: ${error.message}`, 'error');
        throw error;
    }
}


async function restoreKeybinds() {
    try {
        logMessage('Restoring keybinds...');
        const optionsPath = path.join(selectedInstancePath, 'options.txt');

        if (await fs.pathExists(optionsPath) && Object.keys(keybindsBackup).length > 0) {
            // Read the current options.txt
            const content = await fs.readFile(optionsPath, 'utf8');
            const lines = content.split('\n');
            const newLines = [];
            const processedKeys = new Set();

            // Process existing lines, replacing keybinds with backed up values
            for (const line of lines) {
                if (line.startsWith('key_')) {
                    const key = line.substring(0, line.indexOf(':'));
                    if (keybindsBackup[key]) {
                        newLines.push(`${key}:${keybindsBackup[key]}`);
                        processedKeys.add(key);
                    } else {
                        newLines.push(line);
                    }
                } else {
                    newLines.push(line);
                }
            }

            // Add any backed up keybinds that weren't in the file
            for (const key in keybindsBackup) {
                if (!processedKeys.has(key)) {
                    newLines.push(`${key}:${keybindsBackup[key]}`);
                }
            }

            // Write the updated options.txt
            await fs.writeFile(optionsPath, newLines.join('\n'));
            logMessage(`Restored ${Object.keys(keybindsBackup).length} keybinds.`);
        } else {
            logMessage('No keybinds to restore or options.txt not found.', 'warning');
        }
    } catch (error) {
        logMessage(`Error restoring keybinds: ${error.message}`, 'error');
        throw error;
    }
}

// Download large mod files from pastebin
async function downloadLargeMods() {
    try {
        const modsDir = path.join(selectedInstancePath, 'mods');

        // Ensure mods directory exists
        await fs.ensureDir(modsDir);

        logMessage('Reading large mod links from local file...');

        // Read the list of large mod URLs from local file
        const largeModsFilePath = path.join(selectedInstancePath, LARGE_MODS_FILE_PATH);

        if (!await fs.pathExists(largeModsFilePath)) {
            logMessage('Large mods file not found. Make sure syncerData/large_mods.txt exists in the repository.', 'warning');
            return;
        }

        const content = await fs.readFile(largeModsFilePath, 'utf8');
        const modLinks = content.split('\n').filter(line => line.trim());

        if (modLinks.length === 0) {
            logMessage('No large mod links found in file.', 'warning');
            return;
        }

        logMessage(`Found ${modLinks.length} large mod links to download.`);

        // Download each mod
        for (let i = 0; i < modLinks.length; i++) {
            const modUrl = modLinks[i].trim();
            if (!modUrl) continue;

            // Extract filename from URL
            const urlParts = modUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const modFilePath = path.join(modsDir, fileName);

            logMessage(`Downloading large mod (${i + 1}/${modLinks.length}): ${fileName}...`);

            // Check if the file already exists
            const fileExists = await fs.pathExists(modFilePath);
            if (fileExists) {
                logMessage(`${fileName} already exists, skipping download.`);
                continue;
            }

            // Download the file using axios with responseType arraybuffer
            const modResponse = await axios({
                method: 'get',
                url: modUrl,
                responseType: 'arraybuffer'
            });

            // Write the file directly using fs-extra
            await fs.writeFile(modFilePath, Buffer.from(modResponse.data));

            // Update progress
            const overallProgress = 60 + ((i + 1) / modLinks.length) * 20;
            setProgress(overallProgress, `Downloaded mod ${i + 1}/${modLinks.length}`);

            logMessage(`${fileName} downloaded successfully.`);
        }

        logMessage('All large mod files downloaded successfully.');
    } catch (error) {
        logMessage(`Error downloading large mods: ${error.message}`, 'error');
        throw error;
    }
}


async function disablePotatoMods() {
    try {
        logMessage('Reading potato mode disabled mods list...');

        // Read the list of mods to disable from local file
        const potatoDisabledModsPath = path.join(selectedInstancePath, POTATO_DISABLED_MODS_FILE_PATH);

        if (!await fs.pathExists(potatoDisabledModsPath)) {
            logMessage('Potato disabled mods file not found. Make sure syncerData/potato_disabled.txt exists in the repository.', 'warning');
            return;
        }

        const content = await fs.readFile(potatoDisabledModsPath, 'utf8');
        const modsToDisable = content.split('\n').filter(line => line.trim());

        if (modsToDisable.length === 0) {
            logMessage('No mods to disable for potato mode.', 'warning');
            return;
        }

        logMessage(`Found ${modsToDisable.length} mods to disable for potato mode.`);

        // Get all mods in the mods folder
        const modsDir = path.join(selectedInstancePath, 'mods');
        if (!await fs.pathExists(modsDir)) {
            logMessage('Mods folder not found, cannot disable mods.', 'warning');
            return;
        }

        const modFiles = await fs.readdir(modsDir);
        let disabledCount = 0;

        // Log all mod files for debugging
        logMessage(`Found ${modFiles.length} mod files in mods folder.`);

        // Check each mod file against the list of mods to disable
        for (const modFile of modFiles) {
            // Only process .jar files
            if (!modFile.endsWith('.jar')) continue;

            const modFileLower = modFile.toLowerCase();

            // Check if the mod file contains any of the mod names to disable
            for (const modName of modsToDisable) {
                const modNameLower = modName.toLowerCase().trim();
                if (modNameLower && modFileLower.includes(modNameLower)) {
                    const modPath = path.join(modsDir, modFile);
                    const disabledPath = `${modPath}.disabled`;

                    try {
                        // Rename the file to .jar.disabled
                        await fs.rename(modPath, disabledPath);
                        logMessage(`Disabled mod: ${modFile}`, 'removed');
                        disabledCount++;
                    } catch (renameError) {
                        logMessage(`Failed to disable mod ${modFile}: ${renameError.message}`, 'error');
                    }
                    break;
                }
            }
        }

        logMessage(`Disabled ${disabledCount} mods for potato mode.`);
    } catch (error) {
        logMessage(`Error disabling mods for potato mode: ${error.message}`, 'error');
        throw error;
    }
}


// Apply settings profile (default or potato)
async function applySettingsProfile(usePotatoProfile, syncKeybinds) {
    try {
        if (!usePotatoProfile) {
            // Using default profile, nothing specific needed
            logMessage('Using default settings profile.');

            // If not syncing keybinds, restore them
            if (!syncKeybinds) {
                await preserveKeybinds();
            }
            return;
        }

        // Using potato profile
        logMessage('Applying potato settings profile...');
        const potatoFolderPath = path.join(selectedInstancePath, 'potato');

        if (!await fs.pathExists(potatoFolderPath)) {
            logMessage('Potato folder not found, skipping profile application.', 'warning');
            return;
        }

        // Find potato.txt in the potato folder
        const potatoTxtPath = path.join(potatoFolderPath, 'potato.txt');

        if (await fs.pathExists(potatoTxtPath)) {
            // Read and parse potato.txt
            const potatoContent = await fs.readFile(potatoTxtPath, 'utf8');
            const potatoSettings = {};

            for (const line of potatoContent.split('\n')) {
                if (line.trim() && line.includes(':')) {
                    const separatorIndex = line.indexOf(':');
                    const key = line.substring(0, separatorIndex);
                    const value = line.substring(separatorIndex + 1);

                    if (key) potatoSettings[key] = value;
                }
            }

            // Read options.txt
            const optionsPath = path.join(selectedInstancePath, 'options.txt');
            let optionsContent = '';
            let optionsLines = [];

            if (await fs.pathExists(optionsPath)) {
                optionsContent = await fs.readFile(optionsPath, 'utf8');
                optionsLines = optionsContent.split('\n');
            }

            // Extract keybinds if needed
            let keybinds = {};
            if (!syncKeybinds) {
                for (const line of optionsLines) {
                    if (line.startsWith('key_')) {
                        const separatorIndex = line.indexOf(':');
                        const key = line.substring(0, separatorIndex);
                        const value = line.substring(separatorIndex + 1);
                        keybinds[key] = value;
                    }
                }
            }

            // Apply potato settings to options.txt
            const newOptionsLines = [];

            const addedSettings = new Set();

            // Process existing lines
            for (const line of optionsLines) {
                if (line.trim()) {
                    const separatorIndex = line.indexOf(':');
                    if (separatorIndex !== -1) {
                        const key = line.substring(0, separatorIndex);

                        // If key is in potato settings, use potato value unless it's a keybind we want to preserve
                        if (potatoSettings[key] !== undefined &&
                            (!line.startsWith('key_') || syncKeybinds)) {
                            newOptionsLines.push(`${key}:${potatoSettings[key]}`);
                            addedSettings.add(key);
                        }
                        // If it's a keybind we want to preserve
                        else if (line.startsWith('key_') && !syncKeybinds) {
                            newOptionsLines.push(line);
                        }
                        // Otherwise use the original line
                        else {
                            newOptionsLines.push(line);
                        }
                    } else {
                        newOptionsLines.push(line);
                    }
                } else {
                    newOptionsLines.push('');
                }
            }

            // Add any potato settings that weren't in the original options
            for (const key in potatoSettings) {
                if (!addedSettings.has(key) && (!key.startsWith('key_') || syncKeybinds)) {
                    newOptionsLines.push(`${key}:${potatoSettings[key]}`);
                }
            }

            // Write the updated options.txt
            await fs.writeFile(optionsPath, newOptionsLines.join('\n'));
            logMessage('Potato settings applied to options.txt');

            // Copy other config files from potato folder
            const potatoFiles = await fs.readdir(potatoFolderPath);
            const configPath = path.join(selectedInstancePath, 'config');
            await fs.ensureDir(configPath);

            for (const file of potatoFiles) {
                if (file !== 'potato.txt') {
                    const sourcePath = path.join(potatoFolderPath, file);
                    const stat = await fs.stat(sourcePath);

                    if (stat.isFile()) {
                        const destPath = path.join(configPath, file);
                        await fs.copy(sourcePath, destPath, { overwrite: true });
                        logMessage(`Applied potato config: ${file}`);
                    }
                }
            }
        } else {
            logMessage('potato.txt not found in potato folder, skipping settings.', 'warning');
        }
    } catch (error) {
        logMessage(`Error applying settings profile: ${error.message}`, 'error');
        throw error;
    }
}

// Preserve existing keybinds while updating other settings
async function preserveKeybinds() {
    try {
        logMessage('Preserving existing keybinds...');
        const optionsPath = path.join(selectedInstancePath, 'options.txt');

        if (await fs.pathExists(optionsPath)) {
            // Read the current options.txt
            const content = await fs.readFile(optionsPath, 'utf8');
            const lines = content.split('\n');

            // Extract the keybinds
            const keybinds = {};
            for (const line of lines) {
                if (line.startsWith('key_')) {
                    const separatorIndex = line.indexOf(':');
                    if (separatorIndex !== -1) {
                        const key = line.substring(0, separatorIndex);
                        const value = line.substring(separatorIndex + 1);
                        keybinds[key] = value;
                    }
                }
            }

            // Now update the options.txt, preserving keybinds
            const newLines = [];
            for (const line of lines) {
                if (line.startsWith('key_')) {
                    const key = line.split(':')[0];
                    if (keybinds[key]) {
                        newLines.push(`${key}:${keybinds[key]}`);
                    } else {
                        newLines.push(line);
                    }
                } else {
                    newLines.push(line);
                }
            }

            // Write the updated options.txt
            await fs.writeFile(optionsPath, newLines.join('\n'));
            logMessage('Keybinds preserved.');
        } else {
            logMessage('options.txt not found, cannot preserve keybinds.', 'warning');
        }
    } catch (error) {
        logMessage(`Error preserving keybinds: ${error.message}`, 'error');
        throw error;
    }
}

// Turn off shaders when requested
async function turnOffShaders() {
    try {
        logMessage('Turning off shaders...');
        const potatoFolderPath = path.join(selectedInstancePath, 'potato');
        const irisPropertiesPotatoPath = path.join(potatoFolderPath, 'iris.properties');
        const configPath = path.join(selectedInstancePath, 'config');
        const irisPropertiesPath = path.join(configPath, 'iris.properties');

        if (await fs.pathExists(irisPropertiesPotatoPath)) {
            await fs.ensureDir(configPath);
            await fs.copy(irisPropertiesPotatoPath, irisPropertiesPath, { overwrite: true });
            logMessage('Shaders turned off (iris.properties applied).');
        } else {
            logMessage('iris.properties not found in potato folder, cannot turn off shaders.', 'warning');
        }
    } catch (error) {
        logMessage(`Error turning off shaders: ${error.message}`, 'error');
        throw error;
    }
}

// Get all tracked files in the instance
async function getAllModFiles() {
    const result = [];

    for (const trackedPath of TRACKED_PATHS) {
        const fullPath = path.join(selectedInstancePath, trackedPath);

        if (await fs.pathExists(fullPath)) {
            const stats = await fs.stat(fullPath);

            if (stats.isFile()) {
                result.push(trackedPath);
            } else if (stats.isDirectory()) {
                // Scan for all files in the directory
                await scanDirectory(fullPath, trackedPath, result);
            }
        }
    }

    return result;
}

// Scan a directory recursively for files
async function scanDirectory(dirPath, relativePath, result) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
            await scanDirectory(entryPath, entryRelativePath, result);
        } else if (entry.isFile()) {
            // Skip the large mod file in comparisons
            if (relativePath === 'mods' && entry.name === LARGE_MOD_FILENAME) {
                continue;
            }
            result.push(entryRelativePath);
        }
    }
}

// Compare files before and after sync to report changes
function compareFiles(beforeFiles, afterFiles) {
    // Extract filenames without paths for easier comparison
    const getFilename = (path) => path.split(/[\/\\]/).pop();

    // Get base name before version numbers for comparison
    const getBaseName = (filename) => {
        // Match everything before the first number in the filename
        const match = filename.match(/^(.*?)[\d]/);
        return match ? match[1] : filename;
    };

    // Filter to only include mods and resourcepacks
    const filterRelevantPaths = (paths) => {
        return paths.filter(path =>
            path.startsWith('mods\\') ||
            path.startsWith('mods/') ||
            path.startsWith('resourcepacks\\') ||
            path.startsWith('resourcepacks/')
        );
    };

    // Filter to relevant paths only
    const relevantBefore = filterRelevantPaths(beforeFiles);
    const relevantAfter = filterRelevantPaths(afterFiles);

    // Simple added/removed detection
    let added = relevantAfter.filter(file => !relevantBefore.includes(file));
    let removed = relevantBefore.filter(file => !relevantAfter.includes(file));

    // Check for updates (same base name but different filename)
    const updated = [];

    // Create maps of base names to full paths
    const beforeMap = new Map();
    const afterMap = new Map();

    relevantBefore.forEach(file => {
        const filename = getFilename(file);
        const baseName = getBaseName(filename);
        if (!beforeMap.has(baseName)) {
            beforeMap.set(baseName, []);
        }
        beforeMap.get(baseName).push(file);
    });

    relevantAfter.forEach(file => {
        const filename = getFilename(file);
        const baseName = getBaseName(filename);
        if (!afterMap.has(baseName)) {
            afterMap.set(baseName, []);
        }
        afterMap.get(baseName).push(file);
    });

    // Find updates by comparing base names
    for (const [baseName, beforeFiles] of beforeMap.entries()) {
        if (afterMap.has(baseName)) {
            const afterFiles = afterMap.get(baseName);

            // If the exact files don't match but the base name does, it's an update
            if (JSON.stringify(beforeFiles.sort()) !== JSON.stringify(afterFiles.sort())) {
                beforeFiles.forEach(beforeFile => {
                    // Only mark as updated if it's not in the after files
                    if (!relevantAfter.includes(beforeFile)) {
                        // Find the corresponding after file
                        const afterFile = afterFiles.find(af => !relevantBefore.includes(af));
                        if (afterFile) {
                            updated.push({
                                from: beforeFile,
                                to: afterFile
                            });

                            // Remove from added/removed lists
                            removed = removed.filter(file => file !== beforeFile);
                            added = added.filter(file => file !== afterFile);
                        }
                    }
                });
            }
        }
    }

    return { added, removed, updated };
}


// Helper function to log messages with timestamps and optional styling
function logMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logElement = document.createElement('div');
    logElement.className = `log-entry ${type}`;
    logElement.innerHTML = `[${timestamp}] ${message}`;

    if (syncLog) {
        syncLog.appendChild(logElement);
        syncLog.scrollTop = syncLog.scrollHeight;
    }

    console.log(`[${timestamp}] ${message}`);
}

// Fix the progress bar function to ensure visibility
function setProgress(percent, statusText) {
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.style.display = 'block'; // Ensure it's visible
    }
    if (progressStatus) {
        progressStatus.textContent = statusText;
    }
}
