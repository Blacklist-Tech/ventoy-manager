const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const engine = require('./engine');
const logger = require('./logger');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        icon: path.join(__dirname, 'assets/hallmark.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile('renderer/index.html');
    logger.success("Main Window Initialized with Branded Hallmark v10");
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    logger.info("Application Shutting Down");
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('run-command', async (event, command, args) => {
    const drivePath = args[0] || "";
    if (drivePath.toUpperCase().startsWith("C:")) {
        logger.error(`SECURITY ALERT: Blocked attempt to access System Drive ${drivePath}`);
        return { success: false, error: "ACCESS DENIED: System drive protection is active." };
    }

    try {
        if (command === 'detect') {
            const drives = detectDrives();
            return { success: true, output: JSON.stringify(drives) };
        }

        if (command === 'list') {
            const isos = listISOsRecursive(drivePath);
            return { success: true, output: JSON.stringify(isos) };
        }

        if (command === 'add') {
            const [path, isoName, sizeGB, label] = args;
            if (/[&|;><]/.test(isoName)) throw new Error("Filename contains illegal shell characters.");

            logger.info(`Starting Persistence Creation: ${isoName} (${sizeGB}GB, Label: ${label})`);
            await engine.create_persistence(path, isoName, sizeGB, label, (msg) => {
                mainWindow.webContents.send('status-update', msg);
            });
            logger.success(`Persistence Created Successfully: ${isoName}`);
            return { success: true };
        }

        if (command === 'remove') {
            const [path, isoName, deleteFile] = args;
            logger.warn(`Removing Persistence Link: ${isoName}`);
            await engine.remove_persistence(path, isoName, deleteFile);
            return { success: true };
        }

        if (command === 'get-logs') {
            const logPath = path.join(__dirname, 'logs/engine.log');
            if (fs.existsSync(logPath)) {
                const content = fs.readFileSync(logPath, 'utf8').split('\n');
                return { success: true, output: content.slice(-100).join('\n') };
            }
            return { success: true, output: "No logs yet." };
        }

        if (command === 'install-ventoy') {
            const ventoyExe = path.join(__dirname, 'bin/Ventoy2Disk.exe');
            if (!fs.existsSync(ventoyExe)) throw new Error("Ventoy binaries missing.");
            const driveLetter = drivePath.substring(0, 2);

            return new Promise((resolve, reject) => {
                const cmd = `"${ventoyExe}" /I /Drive=${driveLetter} /ST:GPT /Secure /Keep`;
                exec(cmd, (error) => {
                    if (error) { reject(error); return; }
                    resolve({ success: true });
                });
            });
        }
    } catch (err) {
        logger.error(`IPC Failure: ${err.message}`);
        return { success: false, error: err.message };
    }
});

function detectDrives() {
    try {
        const scriptPath = path.join(__dirname, 'detect.ps1');
        let output = execSync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, { encoding: 'utf8' }).toString().trim();

        // Clean JSON extraction
        const jsonStart = output.indexOf('[');
        const jsonEnd = output.lastIndexOf(']') + 1;
        if (jsonStart === -1) return [];
        output = output.substring(jsonStart, jsonEnd);

        const data = JSON.parse(output);
        const driveList = Array.isArray(data) ? data : [data];

        return driveList.map(d => ({
            path: d.path,
            label: d.label || "USB Drive",
            isVentoy: !!d.is_ventoy,
            isAdmin: engine.is_admin(),
            partitions: (d.partitions || []).map(p => ({
                number: p.number,
                label: p.label,
                free_gb: ((p.free_bytes || 0) / (1024 ** 3)).toFixed(1),
                total_gb: ((p.total_bytes || 0) / (1024 ** 3)).toFixed(1),
                free_mb: ((p.free_bytes || 0) / (1024 ** 2)).toFixed(0),
                total_mb: ((p.total_bytes || 0) / (1024 ** 2)).toFixed(0),
                isBoot: !!p.is_boot
            }))
        }));
    } catch (e) {
        logger.error(`Bridge Failure: ${e.message}`);
        return [];
    }
}

function listISOsRecursive(dir, baseDir = null) {
    if (!baseDir) baseDir = dir;
    let results = [];
    try {
        if (!fs.existsSync(dir)) return [];
        let persistenceMap = {};
        const jsonPath = path.join(baseDir, 'ventoy', 'ventoy.json');
        if (fs.existsSync(jsonPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                (config.persistence || []).forEach(e => {
                    if (e.image && e.backend) {
                        persistenceMap[e.image.replace(/^\//, '').toLowerCase()] = e.backend.replace(/^\//, '');
                    }
                });
            } catch (jsonErr) {
                logger.warn(`ventoy.json corruption detected on ${dir}: ${jsonErr.message}`);
            }
        }
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                if (!['ventoy', '$recycle.bin', 'system volume information'].includes(file.toLowerCase())) {
                    results = results.concat(listISOsRecursive(fullPath, baseDir));
                }
            } else if (file.toLowerCase().endsWith('.iso')) {
                const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                const datName = persistenceMap[relPath.toLowerCase()];
                const hasPersistence = datName && fs.existsSync(path.join(baseDir, datName));
                const legacyName = relPath.replace(/\.iso$/i, '-persistence.dat');
                const canAdopt = !hasPersistence && fs.existsSync(path.join(baseDir, legacyName));
                results.push({
                    name: relPath,
                    hasPersistence,
                    size: hasPersistence ? `${(fs.statSync(path.join(baseDir, datName)).size / (1024 ** 3)).toFixed(1)} GB` : "None",
                    canAdopt,
                    backend: datName || (canAdopt ? legacyName : "")
                });
            }
        });
    } catch (e) {
        logger.warn(`Scan error in ${dir}: ${e.message}`);
    }
    return results;
}

ipcMain.on('close-app', () => { app.quit(); });
ipcMain.on('minimize-app', () => { mainWindow.minimize(); });
