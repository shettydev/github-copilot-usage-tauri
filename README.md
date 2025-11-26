# GitHub Copilot Usage Tracker

A system tray application built with Tauri that displays your GitHub Copilot metered usage with real-time percentage bars for Premium and Standard requests.

## Features

- **System Tray Integration**: Lives in your system tray for quick access
- **Usage Visualization**: Visual progress bars showing Premium and Standard request usage
- **Auto-Refresh**: Automatically updates usage data every 5 minutes
- **Secure Token Storage**: Stores your GitHub token locally
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Prerequisites

- Node.js (v20 or higher)
- Rust (latest stable version)
- GitHub Personal Access Token with Copilot access

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Usage

1. Launch the application
2. Enter your GitHub Personal Access Token (PAT)
3. The app will fetch and display your Copilot usage
4. Click the system tray icon to show/hide the usage window
5. Usage data refreshes automatically every 5 minutes

## GitHub Token Setup

You need a GitHub Personal Access Token with the following permissions:
- `copilot` scope (for accessing Copilot usage data)

Create a token at: https://github.com/settings/tokens

## Tech Stack

- **Frontend**: React + TypeScript
- **Backend**: Tauri (Rust)
- **Build Tool**: Vite
- **API**: GitHub Copilot Internal API

## License

MIT
