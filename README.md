# AI Coding Tracker

A VS Code extension that monitors coding behavior and detects AI-assisted programming activities. Designed for educational environments to ensure coding integrity.

**Current Version**: v0.0.3 | **Status**: Production Ready for Monitoring & Detection

## Features

### 🔍 AI Extension Detection
- Automatically scans and detects installed AI coding assistants every 5 minutes
- Supports detection of 25+ popular AI tools including:
  - **GitHub Copilot Series**: GitHub Copilot, Copilot Chat, Copilot Labs
  - **Claude Series**: Cline (Claude Dev), Claude 3 VSCode, Anthropic Claude
  - **Mainstream AI Tools**: Cursor AI Assistant, Tabnine, Codeium, Continue
  - **Cloud Provider AI**: Amazon Q Developer, AWS CodeWhisperer, Google Duet AI
  - **Emerging AI Tools**: Windsurf Cascade, OpenAI VSCode, Meta Code Llama
  - **Other AI Assistants**: Sourcegraph Cody, IntelliCode, Kite AI, BlackBox AI
  - **And more**: DeepCode AI, Cohere AI, StableCode, AI Toolkit

### 📁 Selective Folder Monitoring
- Choose specific folders to monitor on first run
- Focuses monitoring on designated work directories
- Avoids tracking unnecessary files

### 💾 Automatic Save Management
- Automatically enables VS Code's AutoSave feature
- Forces 3-second save intervals for consistent monitoring
- Ensures all code changes are captured

### 📊 Real-time Status Display
- Status bar indicator showing monitoring status
- Quick access to extension information
- Visual feedback on detected AI extensions

## Installation

1. Install the extension through VS Code Extension Marketplace (when published)
2. Or install from VSIX file: `code --install-extension aicodingtracker-0.0.3.vsix`

## Usage

1. **First Run Setup**: The extension will automatically prompt you to select a folder to monitor
2. **Status Monitoring**: Check the status bar for real-time monitoring information
3. **Manual Commands**: Use the Command Palette (`Cmd+Shift+P`) to access:
   - `AI Coding Tracker: Select Monitor Folder` - Choose/change monitored folder
   - `AI Coding Tracker: Show Status` - Display detailed status information

## Extension Settings

This extension contributes the following settings:

* `aiCodingTracker.enabled`: Enable/disable the extension
* `aiCodingTracker.monitoredFolder`: Path to the monitored folder
* `aiCodingTracker.serverEndpoint`: Server API endpoint for data reporting
* `aiCodingTracker.apiToken`: API authentication token
* `aiCodingTracker.reportInterval`: Report interval in milliseconds (default: 5 minutes)
* `aiCodingTracker.alertThreshold`: Alert threshold for line count increase
* `aiCodingTracker.enableRealTimeAlert`: Enable real-time alerts
* `aiCodingTracker.aiScanInterval`: AI plugin scan interval in milliseconds (default: 300000ms/5 minutes)

## Current Status

This extension is **production-ready** for monitoring and detection features. Currently implemented features:

### ✅ Fully Implemented (v0.0.3)
- **AI Extension Detection**: 25+ AI tools, automatic 5-minute scanning
- **Folder Selection and Configuration**: Interactive setup and persistent storage
- **AutoSave Management**: Forced 3-second intervals with workspace configuration
- **Status Bar Integration**: Real-time monitoring status and quick access
- **Code Change Monitoring**: Complete real-time tracking with snapshot storage
- **Anomaly Detection**: Advanced algorithms for suspicious activity detection
- **Alert System**: Multi-level warnings with detailed change analysis
- **Data Persistence**: Comprehensive snapshot management with memory optimization

### 🚧 In Development
- **Server Reporting (Phase 3)**: HTTP API integration and data upload

## Known Issues

- **Server reporting functionality pending** (Phase 3 - HTTP API integration)
- **Network connectivity detection** not yet implemented for offline scenarios
- **Batch data upload mechanism** requires development for efficiency
- **Advanced machine learning algorithms** could enhance detection accuracy further

### Performance Notes
- Extension is optimized for codebases up to 10,000 files
- Memory usage optimized with automatic cleanup and content truncation
- Snapshot storage limited to 7-day retention for performance

## Development Roadmap

### Phase 1: Basic Framework ✅ COMPLETED (v0.0.1)
- [x] Extension framework setup
- [x] AI extension detection (initial 9 tools)
- [x] Folder selection and configuration
- [x] AutoSave enforcement
- [x] Status bar integration
- [x] Command palette integration

### Phase 2: Monitoring & Analysis ✅ COMPLETED (v0.0.2)
- [x] Code change monitoring with real-time tracking
- [x] Anomaly detection algorithms (rapid increase, content replacement)
- [x] Version jump analysis with timestamp tracking
- [x] Local alert system with severity levels
- [x] Snapshot storage system with memory optimization
- [x] Session management and file organization

### Phase 2.5: AI Detection Enhancement ✅ COMPLETED (v0.0.3)
- [x] Extended AI plugin blacklist (25+ tools including Cline, Cursor, Amazon Q)
- [x] Automatic timer-based detection (configurable 5-minute intervals)
- [x] Removed manual scan commands for streamlined UX
- [x] Enhanced configuration validation
- [x] Improved memory management

### Phase 3: Data Reporting 🚧 IN PROGRESS (v0.1.0)
- [ ] HTTP API integration with authentication
- [ ] Batch upload mechanism with compression
- [ ] Offline caching with retry logic
- [ ] Network status detection and error handling
- [ ] Data encryption for secure transmission

### Phase 4: Advanced Features 📋 PLANNED (v0.2.0)
- [ ] Machine learning-based anomaly detection
- [ ] Code complexity analysis algorithms
- [ ] Programming pattern recognition
- [ ] Advanced reporting dashboard
- [ ] Multi-workspace support

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
