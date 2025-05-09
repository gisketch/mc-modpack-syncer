const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    // Uncomment for dev tools
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (mainWindow === null) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Handle folder selection dialog
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (!result.canceled) {
        const folderPath = result.filePaths[0];
        // Check if it looks like a Minecraft instance folder
        const isValidInstance = await checkMinecraftInstance(folderPath);

        return {
            path: folderPath,
            isValidInstance: isValidInstance
        };
    }
    return null;
});

// Helper function to check if a folder is a Minecraft instance
async function checkMinecraftInstance(folderPath) {
    // Check for at least one of these folders or files to exist
    const minecraftFolderIndicators = [
        'mods',
        'config',
        'resourcepacks',
        'shaderpacks',
        'options.txt',
        'logs'
    ];

    let foundIndicators = 0;

    for (const indicator of minecraftFolderIndicators) {
        if (await fs.pathExists(path.join(folderPath, indicator))) {
            foundIndicators++;
        }
    }

    // Consider it a Minecraft instance if at least 2 indicators are found
    return foundIndicators >= 2;
}