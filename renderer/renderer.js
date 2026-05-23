// Ventoy Manager — Production Bridge (v5.1)
const { ipcRenderer } = window.electron;

const elements = {
    // Navigation
    navIso: document.getElementById('nav-iso'),
    navSettings: document.getElementById('nav-settings'),
    isoView: document.getElementById('iso-view'),
    settingsView: document.getElementById('settings-view'),

    // Sidebar
    driveList: document.getElementById('drive-list'),

    // ISO View
    refreshBtn: document.getElementById('refresh-btn'),
    isoGrid: document.getElementById('iso-grid'),

    // Modal
    modal: document.getElementById('modal-overlay'),
    sizeSlider: document.getElementById('size-slider'),
    sizeVal: document.getElementById('size-val'),
    labelSelector: document.getElementById('label-selector'),
    createBtn: document.getElementById('create-btn'),
    cancelBtn: document.getElementById('cancel-btn'),

    // Settings
    settingSuffix: document.getElementById('setting-suffix'),
    settingSafety: document.getElementById('setting-safety'),
    settingDeepScan: document.getElementById('setting-deep-scan'),
    logConsole: document.getElementById('log-console')
};

let allDrives = [];
let currentDrive = null;
let selectedISO = null;
let isEditMode = false;
let logInterval = null;

let settings = {
    suffix: "-persistence.dat",
    safety: true,
    deepScan: true
};

async function init() {
    loadSettings();

    // Window Controls
    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.send('minimize-app');
    });
    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('close-app');
    });

    await scanSystem();
    
    elements.navIso.addEventListener('click', () => switchView('iso'));
    elements.navSettings.addEventListener('click', () => switchView('settings'));
    elements.refreshBtn.addEventListener('click', scanSystem);
    elements.sizeSlider.addEventListener('input', (e) => {
        elements.sizeVal.innerText = e.target.value;
    });
    
    elements.cancelBtn.addEventListener('click', () => elements.modal.classList.add('hidden'));
    elements.createBtn.addEventListener('click', handleAction);

    elements.settingSuffix.addEventListener('change', saveSettings);
    elements.settingSafety.addEventListener('change', saveSettings);
    elements.settingDeepScan.addEventListener('change', saveSettings);

    ipcRenderer.on('status-update', (msg) => {
        const loadingMsg = document.getElementById('loading-msg');
        if (loadingMsg) loadingMsg.innerText = msg;
    });
}

function switchView(view) {
    if (view === 'iso') {
        elements.isoView.classList.remove('hidden');
        elements.settingsView.classList.add('hidden');
        elements.navIso.classList.add('active');
        elements.navSettings.classList.remove('active');
        clearInterval(logInterval);
    } else {
        elements.isoView.classList.add('hidden');
        elements.settingsView.classList.remove('hidden');
        elements.navIso.classList.remove('active');
        elements.navSettings.classList.add('active');
        startLogMonitoring();
    }
}

async function startLogMonitoring() {
    updateLogs();
    logInterval = setInterval(updateLogs, 2000);
}

async function updateLogs() {
    const res = await ipcRenderer.invoke('run-command', 'get-logs', []);
    if (res.success) {
        const wasAtBottom = elements.logConsole.scrollHeight - elements.logConsole.clientHeight <= elements.logConsole.scrollTop + 1;
        elements.logConsole.innerText = res.output;
        if (wasAtBottom) {
            elements.logConsole.scrollTop = elements.logConsole.scrollHeight;
        }
    }
}

function loadSettings() {
    const saved = localStorage.getItem('ventoy_settings');
    if (saved) {
        settings = JSON.parse(saved);
        elements.settingSuffix.value = settings.suffix;
        elements.settingSafety.checked = settings.safety;
        elements.settingDeepScan.checked = settings.deepScan;
    }
}

function saveSettings() {
    settings.suffix = elements.settingSuffix.value;
    settings.safety = elements.settingSafety.checked;
    settings.deepScan = elements.settingDeepScan.checked;
    localStorage.setItem('ventoy_settings', JSON.stringify(settings));
}

async function scanSystem() {
    elements.driveList.innerHTML = '<div class="loading-state-mini">Scanning hardware...</div>';
    try {
        const response = await ipcRenderer.invoke('run-command', 'detect', []);
        if (response.success) {
            const drives = JSON.parse(response.output);
            
            // SECURITY WATCHDOG: Check if first drive reports admin state
            if (drives.length > 0 && !drives[0].isAdmin) {
                document.getElementById('admin-banner').classList.remove('hidden');
            } else {
                document.getElementById('admin-banner').classList.add('hidden');
            }

            // PRIORITY SORTING: Ventoy first, then Raw USBs
            allDrives = drives.filter(d => d && d.path).sort((a, b) => (b.isVentoy === a.isVentoy) ? 0 : b.isVentoy ? 1 : -1);
            
            if (allDrives.length > 0) {
                renderDrives(allDrives);
                if (!currentDrive || !allDrives.find(d => d.path === currentDrive.path)) {
                    selectDrive(allDrives[0]);
                } else {
                    const updated = allDrives.find(d => d.path === currentDrive.path);
                    currentDrive = updated;
                    refreshMainView();
                }
            } else {
                elements.driveList.innerHTML = '<div class="loading-state-mini" style="color: var(--text-dim)">No USB drives detected.</div>';
                currentDrive = null;
                showError("Plug in a USB drive to begin.");
            }
        }
    } catch (err) {
        showError("Hardware Bridge Error.");
    }
}

function renderDrives(drives) {
    elements.driveList.innerHTML = '';
    drives.forEach(drive => {
        const card = document.createElement('div');
        card.className = `drive-card ${currentDrive && currentDrive.path === drive.path ? 'active' : ''}`;
        
        const verifiedBadge = drive.isVentoy ? 
            `<div class="verified-badge"><i data-lucide="shield-check"></i> Ventoy Verified</div>` : 
            `<div class="verified-badge" style="color: #ffaa00; background: rgba(255,170,0,0.1); border-color: rgba(255,170,0,0.2);"><i data-lucide="help-circle"></i> Raw USB</div>`;

        let partHtml = '';
        (drive.partitions || []).forEach(p => {
            if (p.isBoot) {
                const percent = Math.min(100, (1 - (p.free_mb / p.total_mb)) * 100);
                partHtml += `
                    <div class="partition-section">
                        <div class="part-info">
                            <span class="part-name">VTOYEFI (Boot Engine)</span>
                            <span>${p.free_mb} MB / ${p.total_mb} MB</span>
                        </div>
                        <div class="progress-bar"><div class="fill efi" style="width: ${percent}%"></div></div>
                    </div>
                `;
            } else {
                const percent = Math.min(100, (1 - (p.free_gb / p.total_gb)) * 100);
                partHtml += `
                    <div class="partition-section">
                        <div class="part-info">
                            <span class="part-name">${p.label || "Primary Storage"}</span>
                            <span>${p.free_gb} GB / ${p.total_gb} GB</span>
                        </div>
                        <div class="progress-bar"><div class="fill" style="width: ${percent}%"></div></div>
                    </div>
                `;
            }
        });

        card.innerHTML = `
            <span class="fs-badge">${drive.fileSystem}</span>
            <div class="card-header">
                <i data-lucide="hard-drive"></i>
                <span>${drive.label}</span>
            </div>
            ${verifiedBadge}
            ${partHtml}
        `;
        card.onclick = () => selectDrive(drive);
        elements.driveList.appendChild(card);
    });
    lucide.createIcons();
}

function selectDrive(drive) {
    currentDrive = drive;
    renderDrives(allDrives);
    refreshMainView();
}

async function refreshMainView() {
    if (!currentDrive) return;
    if (currentDrive.isVentoy) {
        await loadISOs(currentDrive.path);
    } else {
        renderInstallUI();
    }
}

async function loadISOs(drivePath) {
    showLoading(`Scanning ${drivePath}...`);
    try {
        const response = await ipcRenderer.invoke('run-command', 'list', [drivePath]);
        if (response.success) {
            const isos = JSON.parse(response.output);
            renderISOs(isos);
        }
    } catch (e) {
        showError("Failed to interpret drive contents.");
    }
}

function renderISOs(isos) {
    elements.isoGrid.innerHTML = '';
    if (!isos || isos.length === 0) {
        elements.isoGrid.innerHTML = '<div class="loading-state"><p>No ISO files found.</p></div>';
        return;
    }
    isos.forEach(iso => {
        const card = document.createElement('div');
        card.className = `iso-card ${iso.hasPersistence ? 'has-persistence' : ''}`;
        let actionBtn = '';
        if (iso.hasPersistence) {
            actionBtn = `<button class="btn-secondary" onclick="openManageModal('${iso.name}')"><i data-lucide="settings"></i> Manage</button>`;
        } else if (iso.canAdopt) {
            actionBtn = `<button class="btn-primary" onclick="handleAction('add', '${iso.name}', 1)">Link Persistence</button>`;
        } else {
            actionBtn = `<button class="btn-primary" onclick="openPersistenceModal('${iso.name}')">Add Persistence</button>`;
        }
        card.innerHTML = `
            <div class="iso-info">
                <h3>${iso.name}</h3>
                <span class="status">${iso.hasPersistence ? `<i data-lucide="check"></i> Persistence: ${iso.size}` : 'No Persistence'}</span>
            </div>
            <div class="card-actions">${actionBtn}</div>
        `;
        elements.isoGrid.appendChild(card);
    });
    lucide.createIcons();
}

function renderInstallUI() {
    elements.isoGrid.innerHTML = `
        <div class="loading-state" style="grid-column: 1/-1; padding: 60px;">
            <i data-lucide="alert-triangle" style="color: #ffaa00; width: 48px; height: 48px; margin-bottom: 20px;"></i>
            <h2 style="margin-bottom: 10px;">Not a Ventoy Drive</h2>
            <p style="color: var(--text-dim); margin-bottom: 30px;">Drive ${currentDrive.path} (${currentDrive.fileSystem}) is currently a Raw USB.</p>
            <button class="btn-primary" onclick="installVentoy()" style="padding: 15px 40px; font-size: 16px;">
                <i data-lucide="download"></i> Install Ventoy Engine
            </button>
            <p style="font-size: 12px; color: #ff4444; margin-top: 20px;">WARNING: This will wipe all data on the drive!</p>
        </div>
    `;
    lucide.createIcons();
}

window.installVentoy = async () => {
    if (isOperationInProgress) return;
    if (!confirm(`ARE YOU SURE? This will permanently ERASE all data on ${currentDrive.path}`)) return;
    
    isOperationInProgress = true;
    showLoading("Initializing Ventoy Installer...");
    const res = await ipcRenderer.invoke('run-command', 'install-ventoy', [currentDrive.path]);
    if (res.success) {
        await scanSystem();
    } else {
        showError("Installation failed: " + res.error);
    }
    isOperationInProgress = false;
};

window.openPersistenceModal = (isoName) => {
    selectedISO = isoName;
    isEditMode = false;
    document.getElementById('modal-iso-name').innerText = isoName;
    document.querySelector('.slider-container').classList.remove('hidden');
    elements.createBtn.innerText = "Create Persistence";
    elements.createBtn.className = "btn-primary";
    
    if (isoName.toLowerCase().includes('ubuntu') || isoName.toLowerCase().includes('mint')) {
        elements.labelSelector.value = 'casper-rw';
    } else {
        elements.labelSelector.value = 'persistence';
    }

    elements.modal.classList.remove('hidden');
};

window.openManageModal = (isoName) => {
    selectedISO = isoName;
    isEditMode = true;
    document.getElementById('modal-iso-name').innerText = `Managing Persistence: ${isoName}`;
    document.querySelector('.slider-container').classList.add('hidden');
    elements.createBtn.innerText = "Remove Persistence";
    elements.createBtn.className = "btn-danger";
    elements.modal.classList.remove('hidden');
};

let isOperationInProgress = false;

async function handleAction() {
    if (isOperationInProgress) return;
    isOperationInProgress = true;
    
    elements.modal.classList.add('hidden');
    if (isEditMode) {
        if (settings.safety) {
            if (!confirm("Remove persistence layer? All session data will be lost.")) {
                isOperationInProgress = false;
                return;
            }
        }
        showLoading(`Removing Persistence...`);
        const res = await ipcRenderer.invoke('run-command', 'remove', [currentDrive.path, selectedISO, true]);
        if (res.success) await scanSystem();
    } else {
        const size = elements.sizeSlider.value;
        const label = elements.labelSelector.value;
        
        if (currentDrive.fileSystem === "FAT32" && size > 4) {
            alert("FAT32 does not support files larger than 4GB. Please format your drive to ExFAT.");
            isOperationInProgress = false;
            return;
        }
        showLoading(`Creating ${size}GB Persistence (Label: ${label})...`);
        const res = await ipcRenderer.invoke('run-command', 'add', [currentDrive.path, selectedISO, size, label]);
        if (res.success) await scanSystem();
    }
    isOperationInProgress = false;
}

function showLoading(msg) {
    elements.isoGrid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p id="loading-msg">${msg}</p></div>`;
}

function showError(msg) {
    elements.isoGrid.innerHTML = `<div class="loading-state"><i data-lucide="alert-circle" style="color: #ff4444"></i><p>${msg}</p></div>`;
}

init();
