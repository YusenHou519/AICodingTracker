# Change Log

All notable changes to the "aicodingtracker" extension will be documented in this file.

## [0.0.3] - 2024-12-19

### Added - Phase 2.5: AI Detection Enhancement ✅
- **Extended AI Plugin Detection**: Expanded from 9 to 25+ mainstream AI tools
  - Added support for Cline (Claude Dev), Cursor AI Assistant, Amazon Q Developer
  - Added Windsurf Cascade, OpenAI VSCode, Google Duet AI, Meta Code Llama
  - Added Kite AI, BlackBox AI, DeepCode AI, and more emerging tools
- **Automatic Timer-based Detection**: 
  - Every 5 minutes automatic AI plugin scanning
  - Configurable scan interval via `aiCodingTracker.aiScanInterval`
  - Removed manual scan commands for simplified user experience
- **Enhanced User Interface**:
  - Removed manual AI extension scan command from Command Palette
  - Streamlined user interaction model
  - Background monitoring with minimal user intervention

### Technical Improvements
- Improved timer management with proper cleanup
- Enhanced configuration validation
- Better memory management for plugin detection

## [0.0.2] - 2024-12-19

### Added - Phase 2: Monitoring & Analysis ✅
- **Code Change Monitoring**: Complete real-time code tracking system
  - Full snapshot storage system to globalStorageUri
  - Version history tracking and management
  - Document save event monitoring
  - Session management and file organization
- **Anomaly Detection Algorithm**: Basic version implemented
  - Rapid code increase detection (>50 lines in <30 seconds)
  - Content hash comparison for complete replacement detection
  - Suspicious activity alerting system
- **Advanced Snapshot Management**:
  - Memory optimization for large files
  - Automatic cleanup of old snapshots (7-day retention)
  - Content hash deduplication
  - Secure file name handling
- **Real-time Alert System**:
  - Immediate suspicious activity notifications
  - Detailed change information display
  - Severity-based alert categorization (low/medium/high)
  - User-friendly alert dialogs with detailed analysis

### Bug Fixes
- Fixed critical logic errors in getPreviousSnapshot method
- Enhanced file path security to prevent injection attacks
- Updated deprecated fs.rmdir to fs.promises.rm
- Improved error handling throughout the codebase

### Technical Implementation
- Comprehensive snapshot data structure
- Robust error handling and validation
- Performance optimizations for memory usage
- Enhanced logging and debugging capabilities

## [0.0.1] - 2024-12-19

### Added - Phase 1: Basic Framework ✅
- **Extension Framework**: Complete VS Code extension setup with configuration management
- **AI Extension Detection**: Automatic scanning and detection of AI coding assistants
  - Support for GitHub Copilot, Tabnine, Codeium, AWS CodeWhisperer, IntelliCode, and more
  - Real-time warning notifications when AI extensions are detected
- **Folder Selection**: Interactive folder selection for targeted monitoring
  - First-run setup wizard
  - Persistent configuration storage
  - Manual folder reselection command
- **AutoSave Management**: Automatic enforcement of VS Code AutoSave settings
  - Forces 3-second AutoSave interval
  - Workspace-level configuration
  - User notification on activation
- **Status Bar Integration**: Real-time monitoring status display
  - AI extension count indicator
  - Monitoring status display
  - Quick access to detailed status information
- **Command Palette Integration**: Main commands available
  - Select/change monitored folder
  - Display detailed status

### Technical Implementation
- TypeScript-based architecture
- Comprehensive configuration system (8 configurable options)
- Event-driven document monitoring foundation
- Robust error handling and user feedback

---

## 🚀 Development Status

### ✅ Completed Phases
- **Phase 1**: Basic Framework (v0.0.1)
- **Phase 2**: Monitoring & Analysis (v0.0.2)  
- **Phase 2.5**: AI Detection Enhancement (v0.0.3)

### ⏳ Upcoming Phases
- **Phase 3**: Server Reporting & Data Upload
- **Phase 4**: Performance Optimization & Testing

---

## 📊 Feature Summary

### Core Capabilities (Current Version)
- ✅ **AI Plugin Detection**: 25+ mainstream AI tools supported
- ✅ **Automatic Monitoring**: Real-time code change tracking
- ✅ **Anomaly Detection**: Suspicious activity identification
- ✅ **Smart Alerts**: Multi-level warning system
- ✅ **Data Persistence**: Comprehensive snapshot storage
- ✅ **User Interface**: Status bar integration and commands