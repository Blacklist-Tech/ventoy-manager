# Ventoy Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue.svg)]()
[![Electron](https://img.shields.io/badge/built%20with-Electron-47848f.svg)](https://www.electronjs.org/)

A desktop utility for managing [Ventoy](https://www.ventoy.net/) bootable USB drives with persistence layer support and built-in hardware safety guards. Designed for technicians, IT professionals, and power users.

## Features

- **Drive Discovery** — Automatically detects Ventoy-formatted drives, even when OS volume labels are missing
- **Persistence Management** — Create and manage Ext2/Ext4 persistence layers with pre-flight disk space auditing
- **System Drive Protection** — Programmatic block on the `C:` drive to prevent accidental writes to the system disk
- **Partition Telemetry** — Visual breakdown of storage usage across data and EFI boot partitions
- **Atomic Operations** — UI guards against race conditions during disk operations

## Requirements

- Windows 10 or 11
- Administrator privileges (required for disk I/O)
- [Node.js](https://nodejs.org/) 18+ (development only)

## Installation

### From source

```bash
git clone https://github.com/Blacklist-Tech/ventoy-manager.git
cd ventoy-manager
npm install
npm start
```

### Pre-built binary

Download the latest release from the [Releases](https://github.com/Blacklist-Tech/ventoy-manager/releases) page.

## Usage

1. Launch Ventoy Manager as Administrator
2. Insert a Ventoy-formatted USB drive
3. Use the dashboard to view partition info, create persistence, or manage boot configurations

## Architecture

- **Frontend** — HTML/CSS/JS (Electron renderer)
- **Backend** — Node.js (Electron main process)
- **Hardware Bridge** — PowerShell 5.1+ for native Windows disk operations
- **IPC** — Sanitized shell commands over Electron's `contextBridge` with injection prevention

## Contributing

Bug reports and pull requests are welcome. Please open an issue to discuss changes before submitting a PR.

## License

MIT © [Blacklist Tech](https://github.com/Blacklist-Tech)
