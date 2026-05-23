const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./logger');

class PersistenceEngine {
    constructor() {}

    async create_persistence(drivePath, isoName, sizeGB, label = "persistence", onProgress = () => {}) {
        const datFileName = isoName.replace(/\.iso$/i, '-persistence.dat');
        const datPath = path.join(drivePath, datFileName);
        const sizeBytes = sizeGB * 1024 * 1024 * 1024;

        // PRE-FLIGHT: Check actual free space on disk
        onProgress(`Verifying Disk Space...`);
        try {
            const stats = execSync(`powershell -Command "(Get-Volume -DriveLetter ${drivePath[0]}).SizeRemaining"`, { encoding: 'utf8' }).trim();
            const freeBytes = parseInt(stats);
            if (freeBytes < sizeBytes) {
                throw new Error(`Insufficient real space. Need ${sizeGB}GB, but only ${(freeBytes / (1024**3)).toFixed(1)}GB is available.`);
            }
        } catch (spaceErr) {
            logger.warn(`Space check failed: ${spaceErr.message}`);
            // We continue as a fallback, but the warning is logged
        }

        onProgress(`Allocating ${sizeGB}GB Sparse File...`);
        try {
            execSync(`fsutil file createnew "${datPath}" ${sizeBytes}`);
            execSync(`fsutil sparse setflag "${datPath}"`);
            
            onProgress(`Seeding Ext2 Superblock (Label: ${label})...`);
            this.inject_ext2_superblock(datPath, sizeBytes, label);

            onProgress(`Registering with Ventoy Config...`);
            this.update_ventoy_json(drivePath, isoName, datFileName);

            return true;
        } catch (e) {
            logger.error(`Engine Error: ${e.message}`);
            throw e;
        }
    }

    inject_ext2_superblock(filePath, totalSize, label) {
        const fd = fs.openSync(filePath, 'r+');
        const buffer = Buffer.alloc(1024);
        buffer.writeUInt16LE(0xEF53, 56);
        const blockCount = Math.floor(totalSize / 1024);
        buffer.writeUInt32LE(blockCount, 4);
        buffer.write(label, 120, 'ascii');
        fs.writeSync(fd, buffer, 0, 1024, 1024);
        fs.closeSync(fd);
    }

    update_ventoy_json(drivePath, isoName, datFileName) {
        const ventoyDir = path.join(drivePath, 'ventoy');
        if (!fs.existsSync(ventoyDir)) fs.mkdirSync(ventoyDir);
        const jsonPath = path.join(ventoyDir, 'ventoy.json');
        let config = {};
        if (fs.existsSync(jsonPath)) {
            try {
                config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            } catch (e) {
                config = {};
            }
        }
        if (!config.persistence) config.persistence = [];
        const isoRef = "/" + isoName.replace(/\\/g, '/');
        const datRef = "/" + datFileName.replace(/\\/g, '/');
        const idx = config.persistence.findIndex(e => e.image === isoRef);
        if (idx > -1) {
            config.persistence[idx].backend = datRef;
        } else {
            config.persistence.push({ image: isoRef, backend: datRef });
        }
        fs.writeFileSync(jsonPath, JSON.stringify(config, null, 4));
    }

    async remove_persistence(drivePath, isoName, deleteFile = false) {
        const jsonPath = path.join(drivePath, 'ventoy', 'ventoy.json');
        if (!fs.existsSync(jsonPath)) return;
        let config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const isoRef = "/" + isoName.replace(/\\/g, '/');
        const entry = config.persistence.find(e => e.image === isoRef);
        if (entry && deleteFile) {
            const datPath = path.join(drivePath, entry.backend.replace(/^\//, ''));
            if (fs.existsSync(datPath)) fs.unlinkSync(datPath);
        }
        config.persistence = config.persistence.filter(e => e.image !== isoRef);
        fs.writeFileSync(jsonPath, JSON.stringify(config, null, 4));
    }

    is_admin() {
        try {
            execSync('net session', { stdio: 'ignore' });
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new PersistenceEngine();
