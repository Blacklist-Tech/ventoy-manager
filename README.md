# Ventoy Manager V1.0 🥂
### Professional Persistence & Multiboot Management Suite

**Ventoy Manager** is a premium, Apple-grade desktop utility designed for professional technicians and power users. It provides a hardened, visual interface for managing Ventoy bootable media, specialized in production-ready persistence layers and hardware safety.

![Hallmark](assets/hallmark.png)

## 🛡️ The "Steel Wall" Safety Engine
Ventoy Manager is engineered with absolute hardware safety at its core:
*   **System Drive Protection**: Programmatic blocking of the `C:` drive to prevent accidental data loss.
*   **Atomic UI Guard**: Prevents race conditions during heavy disk operations (Install/Create/Remove).
*   **Triple-Check Detection**: A robust discovery engine that identifies Ventoy geometry even when OS labels are missing.

## ✨ Key Features
*   **X-Ray Telemetry**: High-fidelity visualization of partition storage (Free/Total) for both Data and EFI Boot Engine.
*   **One-Click Persistence**: Create stable Ext2/Ext4 persistence layers with pre-flight disk space auditing.
*   **Production Hardened**: Hardened against shell injection and environmental instability.
*   **Blacklist Aesthetic**: Premium dark mode interface designed for high-end studio and field environments.

## 🚀 Getting Started

### Prerequisites
*   **Windows 10/11**
*   **Administrative Privileges** (Required for disk manipulation)
*   [Node.js](https://nodejs.org/) (For development)

### Installation (Dev Mode)
1. Clone the repository:
   ```bash
   git clone https://github.com/YourUsername/ventoy-manager.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the suite:
   ```bash
   npm start
   ```

## 🛠️ Tech Stack
*   **Core**: Electron / Node.js
*   **Hardware Bridge**: PowerShell 5.1+ (Native Windows Integration)
*   **Styling**: Vanilla CSS (Custom Design System)

## 🛡️ Security & Integrity
The application uses a secure IPC bridge for hardware commands. All shell inputs are sanitized to block command injection, and a global **Admin Watchdog** ensures the engine only runs when permissions are elevated.

---
Built by **Blacklist Tech** — *Production. Repair. Innovation.*
