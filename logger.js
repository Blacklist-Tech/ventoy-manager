const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'engine.log');
        
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] [${type}] ${message}\n`;
        
        console.log(entry.trim());
        
        try {
            fs.appendFileSync(this.logFile, entry);
            // Simple rotation: If log > 2MB, clear it
            const stats = fs.statSync(this.logFile);
            if (stats.size > 2 * 1024 * 1024) {
                fs.writeFileSync(this.logFile, `[${timestamp}] [SYSTEM] Log Rotated.\n`);
            }
        } catch (e) {
            console.error("Logging failed:", e);
        }
    }

    error(message) { this.log(message, 'ERROR'); }
    warn(message) { this.log(message, 'WARN'); }
    success(message) { this.log(message, 'SUCCESS'); }
}

module.exports = new Logger();
