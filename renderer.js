const { ipcRenderer } = require('electron');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Constants

// const REPO_URL = 'https://github.com/gisketch/ckdm-mods.git';
// const LARGE_MOD_URL = 'https://cdn.modrinth.com/data/MdwFAVRL/versions/eLcb8xod/Cobblemon-neoforge-1.6.1%2B1.21.1.jar';
const LARGE_MOD_FILENAME = 'Cobblemon-neoforge-1.6.1+1.21.1.jar';

// Constants
const REPO_URL = 'https://github.com/gisketch/ckdm-mods.git';
// Pastebin URLs for mod links and potato mode disabled mods
const LARGE_MODS_PASTEBIN_URL = 'https://pastebin.com/raw/0BZqtTNN';
const POTATO_DISABLED_MODS_PASTEBIN_URL = 'https://pastebin.com/raw/ahiJPFqU';


// Tracked folders and files
const TRACKED_PATHS = [
    'config',
    'resourcepacks',
    'shaderpacks',
    'mods',
    'potato',
    'options.txt'
];

// UI elements
const browseBtn = document.getElementById('browse-btn');
const syncBtn = document.getElementById('sync-btn');
const statusMessage = document.getElementById('status-message');
const folderPathDisplay = document.getElementById('folder-path');
const syncOptionsCheckbox = document.getElementById('sync-options');
const syncKeybindsCheckbox = document.getElementById('sync-keybinds');
const turnOnShadersCheckbox = document.getElementById('turn-on-shaders');
const profileSelector = document.getElementById('profile-selector');
const defaultProfileRadio = document.getElementById('profile-default');
const potatoProfileRadio = document.getElementById('profile-potato');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const syncLogContainer = document.getElementById('sync-log-container');
const syncLog = document.getElementById('sync-log');

// Store selected paths
let selectedInstancePath = null;
// Store keybinds backup
let keybindsBackup = {};

// Enable/disable profile selector based on sync options checkbox
if (syncOptionsCheckbox && profileSelector) {
    syncOptionsCheckbox.addEventListener('change', () => {
        const isChecked = syncOptionsCheckbox.checked;
        if (defaultProfileRadio) defaultProfileRadio.disabled = !isChecked;
        if (potatoProfileRadio) potatoProfileRadio.disabled = !isChecked;

        // Visual feedback
        if (profileSelector) profileSelector.style.opacity = isChecked ? '1' : '0.5';
    });
}

// Add event listeners
if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
        const folderData = await ipcRenderer.invoke('select-folder');

        if (folderData) {
            selectedInstancePath = folderData.path;
            if (folderPathDisplay) folderPathDisplay.textContent = `Instance folder: ${selectedInstancePath}`;

            if (folderData.isValidInstance) {
                if (statusMessage) statusMessage.textContent = 'Minecraft instance folder detected! Ready to sync.';
                if (syncBtn) syncBtn.disabled = false;
            } else {
                if (statusMessage) statusMessage.textContent = 'Selected folder does not appear to be a valid Minecraft instance.';
                if (syncBtn) syncBtn.disabled = true;
            }
        }
    });
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
            const syncOptions = syncOptionsCheckbox ? syncOptionsCheckbox.checked : false;
            const syncKeybinds = syncKeybindsCheckbox ? syncKeybindsCheckbox.checked : false;
            const turnOnShaders = turnOnShadersCheckbox ? turnOnShadersCheckbox.checked : false;
            const usePotatoProfile = potatoProfileRadio && potatoProfileRadio.checked && syncOptions;

            // Backup keybinds before any operations if we're not syncing them
            if (!syncKeybinds) {
                await backupKeybinds();
            }

            // Start sync process
            await syncModpack(syncOptions, syncKeybinds, turnOnShaders, usePotatoProfile);

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

async function syncModpack(syncOptions, syncKeybinds, turnOnShaders, usePotatoProfile) {
    try {
        // Step 1: Setup git repository
        setProgress(10, 'Setting up repository...');
        await setupGitRepository();

        // Step 2: Get paths before sync for comparison
        const beforeFiles = await getAllModFiles();

        // Backup keybinds before any operations if we're not syncing them
        if (!syncKeybinds) {
            await backupKeybinds();
        }

        // Step 3: Sync all tracked folders and files
        setProgress(30, 'Syncing from repository...');
        await syncFromRepository();

        // Step 4: Restore keybinds immediately after sync if not syncing keybinds
        if (!syncKeybinds) {
            await restoreKeybinds();
        }

        // Step 5: Download and install large mod files from pastebin
        setProgress(60, 'Downloading large mod files...');
        await downloadLargeMods();

        // Step 6: Get paths after sync for comparison
        const afterFiles = await getAllModFiles();

        // Step 7: Handle options and settings
        setProgress(80, 'Applying settings...');
        if (syncOptions) {
            await applySettingsProfile(usePotatoProfile, syncKeybinds);

            // Restore keybinds again after profile application if needed
            if (!syncKeybinds) {
                await restoreKeybinds();
            }
        }

        // Step 8: Handle shader settings if needed
        if (!turnOnShaders && !usePotatoProfile) {
            await turnOffShaders();
        }

        // Step 9: If in potato mode, disable specified mods
        if (usePotatoProfile) {
            await disablePotatoMods();
        }

        // Step 10: Calculate changes for reporting
        const { added, removed, changed } = compareFiles(beforeFiles, afterFiles);

        // Report changes
        logMessage('Sync completed successfully!');
        logMessage(`Added: ${added.length} files`);
        added.forEach(file => logMessage(`  + ${file}`, 'added'));

        logMessage(`Removed: ${removed.length} files`);
        removed.forEach(file => logMessage(`  - ${file}`, 'removed'));

        setProgress(100, 'Sync completed!');
    } catch (error) {
        logMessage(`Error during sync: ${error.message}`, 'error');
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


// Update createGitIgnore to use axios
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
        // Fetch the list of large mod URLs from pastebin to dynamically create ignores
        const response = await axios.get(LARGE_MODS_PASTEBIN_URL);

        if (response.status === 200) {
            const modLinks = response.data.split('\n').filter(line => line.trim());

            for (const modUrl of modLinks) {
                if (modUrl.trim()) {
                    // Extract filename from URL
                    const urlParts = modUrl.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    content += `mods/${fileName}\n`;
                }
            }
        } else {
            // Fallback to the hardcoded filename if fetch fails
            content += `mods/${LARGE_MOD_FILENAME}\n`;
        }
    } catch (error) {
        // Fallback to the hardcoded filename if fetch fails
        content += `mods/${LARGE_MOD_FILENAME}\n`;
        logMessage(`Warning: Could not fetch mod list for gitignore: ${error.message}`, 'warning');
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


// Backup keybinds from options.txt
async function backupKeybinds() {
    try {
        logMessage('Backing up keybinds...');
        const optionsPath = path.join(selectedInstancePath, 'options.txt');
        keybindsBackup = {};

        if (await fs.pathExists(optionsPath)) {
            const content = await fs.readFile(optionsPath, 'utf8');
            const lines = content.split('\n');

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
            logMessage(`Backed up ${Object.keys(keybindsBackup).length} keybinds.`);
        } else {
            logMessage('options.txt not found, no keybinds to backup.', 'warning');
        }
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

        logMessage('Fetching large mod links from pastebin...');

        // Fetch the list of large mod URLs from pastebin using axios
        const response = await axios.get(LARGE_MODS_PASTEBIN_URL);

        if (response.status !== 200) {
            throw new Error(`Failed to fetch large mod links: ${response.statusText}`);
        }

        const content = response.data;
        const modLinks = content.split('\n').filter(line => line.trim());

        if (modLinks.length === 0) {
            logMessage('No large mod links found in pastebin.', 'warning');
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
        logMessage('Fetching potato mode disabled mods list...');

        // Fetch the list of mods to disable from pastebin
        const response = await fetch(POTATO_DISABLED_MODS_PASTEBIN_URL);

        if (!response.ok) {
            throw new Error(`Failed to fetch potato disabled mods list: ${response.statusText}`);
        }

        const content = await response.text();
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
                        logMessage(`Disabled mod: ${modFile}`);
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

// Compare before and after file lists to determine changes
function compareFiles(beforeFiles, afterFiles) {
    const added = afterFiles.filter(file => !beforeFiles.includes(file));
    const removed = beforeFiles.filter(file => !afterFiles.includes(file));

    // For changed files, we'd need to hash or compare timestamps
    // Using a simplified approach for now - files with same name but different sizes
    const changed = [];

    return { added, removed, changed };
}

// Compare files before and after sync
function compareFiles(beforeFiles, afterFiles) {
    const beforeSet = new Set(beforeFiles);
    const afterSet = new Set(afterFiles);

    const added = afterFiles.filter(file => !beforeSet.has(file));
    const removed = beforeFiles.filter(file => !afterSet.has(file));

    // For changed files, we can only detect if they exist in both sets
    // We can't actually detect content changes without more complex comparison
    const commonFiles = afterFiles.filter(file => beforeSet.has(file));
    const changed = []; // In a real implementation, you'd compare file contents here

    return { added, removed, changed };
}

// Log message to the UI
function logMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    if (syncLog) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        syncLog.appendChild(logEntry);
        syncLog.scrollTop = syncLog.scrollHeight;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
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
