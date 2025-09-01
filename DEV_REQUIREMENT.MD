# AI Coding Tracker 插件开发需求

## 📋 项目概述

**目标**：开发轻量级 VS Code 插件，检测 AI 编程助手使用，监控指定文件夹的编程行为，检测异常代码增长并上报服务器。

**策略**：检测-监控-分析-上报
- 检测已安装的 AI 编程插件
- 监控用户指定文件夹的编程活动  
- 分析代码变化模式和时间特征
- 自动上报异常情况到服务器

## 🎯 核心功能

### 1. AI 插件检测 [🔄 需要升级]
```javascript
// 当前版本 (9个插件)
const AI_EXTENSIONS = [
  'github.copilot',
  'github.copilot-chat', 
  'tabnine.tabnine-vscode',
  'codeium.codeium',
  'amazonwebservices.aws-toolkit-vscode',
  'visualstudioexptteam.vscodeintellicode',
  'continue.continue',
  'sourcegraph.cody-ai'
];

// 扩展版本 (20+个插件) - 新增需求
const AI_EXTENSIONS_EXTENDED = [
  // 现有插件
  'github.copilot',
  'github.copilot-chat',
  'tabnine.tabnine-vscode',
  'codeium.codeium',
  'amazonwebservices.aws-toolkit-vscode',
  'visualstudioexptteam.vscodeintellicode',
  'continue.continue',
  'sourcegraph.cody-ai',
  
  // 新增流行AI插件
  'saoudrizwan.claude-dev',           // Cline (Claude Dev)
  'anthropic.claude-3-vscode',        // Claude 3官方插件
  'cursor.cursor-vscode',             // Cursor AI Assistant
  'windsurf.windsurf-cascade',        // Windsurf Cascade
  'amazon.q-developer',               // Amazon Q Developer
  'openai.openai-vscode',             // OpenAI官方插件
  'google.duet-ai',                   // Google Duet AI
  'meta.code-llama',                  // Meta Code Llama
  'microsoft.github-copilot-labs',    // GitHub Copilot Labs
  'kite.kite',                        // Kite AI
  'deepcode.deepcode',                // DeepCode AI
  'intellij.ai-assistant',            // IntelliJ AI Assistant
  'stability.stablecode',             // StableCode
  'cohere.cohere-vscode',             // Cohere AI
  'ai-toolkit.ai-toolkit',            // AI Toolkit
  'blackbox.blackbox-ai'              // BlackBox AI
];
```

**已实现功能：**
- ✅ 扫描所有已安装的VS Code插件
- ✅ 支持9个主要AI编程助手的检测
- ✅ 实时警告通知和状态显示
- ✅ 状态栏集成显示
- ❌ ~~手动重新扫描功能~~ (新需求：移除)

**新增需求：**
- 🆕 **扩展AI插件黑名单** - 支持20+个AI编程助手检测
- 🆕 **自动定时检测** - 每5分钟自动扫描一次，无需手动触发
- 🆕 **移除手动命令** - 取消 `aicodingtracker.scanAIExtensions` 命令

### 2. 文件夹监控 [✅ 已完成]
```javascript
// 首次启动时选择监控文件夹
async function setupMonitoredFolder() {
  const config = vscode.workspace.getConfiguration('aiCodingTracker');
  let monitoredPath = config.get('monitoredFolder');
  
  if (!monitoredPath) {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      openLabel: '选择要监控的工作文件夹'
    });
    if (folderUri && folderUri[0]) {
      monitoredPath = folderUri[0].fsPath;
      await config.update('monitoredFolder', monitoredPath, vscode.ConfigurationTarget.Global);
    }
  }
  return monitoredPath;
}
```

**已实现功能：**
- ✅ 首次运行时的交互式文件夹选择
- ✅ 配置持久化存储（全局设置）
- ✅ 可随时更改监控文件夹
- ✅ 只监控指定目录，避免全局追踪
- ✅ 用户友好的选择界面和提示

### 3. AutoSave 监控 [✅ 已完成]
```javascript
// 完整的快照存储系统
class SnapshotManager {
  constructor(context: vscode.ExtensionContext) {
    this.snapshotDir = path.join(context.globalStorageUri.fsPath, 'snapshots');
    this.sessionId = this.generateSessionId();
    this.ensureDirectoryExists();
  }
  
  async createSnapshot(document: vscode.TextDocument, monitoredFolder: string): Promise<CodeSnapshot> {
    const snapshot: CodeSnapshot = {
      id: `${this.sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      sessionId: this.sessionId,
      filePath: document.uri.fsPath,
      relativePath: this.getRelativePath(document.uri.fsPath, monitoredFolder),
      content: document.getText(),
      lineCount: document.lineCount,
      characterCount: document.getText().length,
      hash: this.generateContentHash(document.getText()),
      metadata: {
        fileSize: Buffer.byteLength(document.getText(), 'utf8'),
        language: document.languageId,
        encoding: 'utf8'
      }
    };
    
    // 保存到内存和磁盘
    await this.saveSnapshotToDisk(snapshot);
    return snapshot;
  }
}

// 集成的代码变化监控
private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
  const snapshot = await this.snapshotManager.createSnapshot(document, this.monitoredFolder);
  const relativePath = this.snapshotManager.getRelativePath(document.uri.fsPath, this.monitoredFolder);
  const previousSnapshot = this.snapshotManager.getPreviousSnapshot(relativePath);
  
  if (previousSnapshot) {
    this.analyzeCodeChange(previousSnapshot, snapshot);
  }
}
```

**已实现功能：**
- ✅ VS Code AutoSave强制启用（3秒间隔）
- ✅ 完整的快照存储系统到globalStorageUri
- ✅ 版本历史追踪和管理
- ✅ 自动清理旧快照（7天保留期）
- ✅ 内容哈希和去重机制
- ✅ 会话管理和文件组织
- ✅ 实时代码变化分析
- ✅ 基础异常检测算法
- ✅ 用户警告和详情显示

### 4. 异常检测算法 [✅ 基础版本已完成]
```javascript
// 已实现：基础异常检测算法
private isChangesSuspicious(previous: CodeSnapshot, current: CodeSnapshot): boolean {
  const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
  const lineDiff = current.lineCount - previous.lineCount;
  
  // 检测大量代码突增
  if (lineDiff > 50 && timeDiff < 30000) {
    return true;
  }
  
  // 检测内容完全替换（可能是粘贴）
  if (previous.hash !== current.hash && 
      Math.abs(current.characterCount - previous.characterCount) > 500) {
    return true;
  }
  
  return false;
}

// 已实现：可疑变化处理
private handleSuspiciousChange(previous: CodeSnapshot, current: CodeSnapshot): void {
  const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
  const lineDiff = current.lineCount - previous.lineCount;
  
  let alertType = 'unknown';
  let severity: 'low' | 'medium' | 'high' = 'medium';
  
  if (lineDiff > 50 && timeDiff < 30000) {
    alertType = 'rapid_code_increase';
    severity = 'high';
  }
  
  // 显示警告给用户
  vscode.window.showWarningMessage(
    `检测到可疑代码变化: ${current.relativePath} (${lineDiff} 行, ${timeDiff}ms)`,
    '查看详情'
  );
}
```

**已实现功能：**
- ✅ 大量代码突增检测（>50行/30秒）
- ✅ 内容哈希比较检测完全替换
- ✅ 实时警告通知系统
- ✅ 详细变化信息显示
- ✅ 分级警报系统（low/medium/high）
- ✅ 控制台日志记录

**高级功能待实现：**
- ⏳ 代码复杂度计算
- ⏳ 编程速度模式学习
- ⏳ 动态阈值调整
- ⏳ 代码风格一致性分析

### 5. 服务器上报 [⏳ 设计完成，待实现]
```javascript
// 设计方案：数据上报结构
interface ReportData {
  sessionId: string;
  userId: string;
  timestamp: Date;
  aiExtensionsDetected: string[];
  codeChanges: CodeSnapshot[];
  alerts: Alert[];
  totalEditingTime: number;
  totalLinesWritten: number;
  suspiciousEventCount: number;
}
```

**设计完成的功能：**
- 📋 HTTP API接口规范
- 📋 数据上报结构定义
- 📋 批量上传机制设计
- 📋 离线缓存策略
- 📋 错误处理和重试机制

**待实现：**
- ⏳ HTTP请求实现
- ⏳ 数据加密和压缩
- ⏳ 网络状态检测
- ⏳ 上报队列管理

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                 AI Coding Tracker 插件                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│  AI插件检测     │   文件夹监控    │      变化分析           │
│  - 扫描插件     │   - 指定目录    │      - 代码增量         │
│  - 黑名单匹配   │   - AutoSave    │      - 时间分析         │
│  - 状态记录     │   - 版本追踪    │      - 异常检测         │
└─────────────────┴─────────────────┴─────────────────────────┘
           │                │                    │
           ▼                ▼                    ▼
┌─────────────────┬─────────────────┬─────────────────────────┐
│   本地缓存      │   警报系统      │      服务器上报         │
│   - 代码快照    │   - 分级告警    │      - HTTP API         │
│   - 监控日志    │   - 实时提示    │      - 批量上传         │
│   - 配置存储    │   - 事件记录    │      - 离线缓存         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## ⚙️ 配置项
```javascript
{
  "aiCodingTracker.monitoredFolder": "",           // 监控文件夹路径
  "aiCodingTracker.serverEndpoint": "",            // 服务器API端点
  "aiCodingTracker.apiToken": "",                  // API认证Token
  "aiCodingTracker.reportInterval": 300000,        // 上报间隔(毫秒)
  "aiCodingTracker.alertThreshold": 50,            // 警报阈值(行数)
  "aiCodingTracker.enableRealTimeAlert": true,     // 启用实时警报
  "aiCodingTracker.enabled": true,                 // 启用/禁用扩展
  "aiCodingTracker.aiScanInterval": 300000         // 🆕 AI插件检测间隔(毫秒，默认5分钟)
}
```

## 🔧 技术实现细节 (新增需求)

### 1. 定时AI插件检测实现
```typescript
class AICodingTracker {
  private aiScanTimer: NodeJS.Timeout | null = null;
  private readonly AI_SCAN_INTERVAL = 5 * 60 * 1000; // 5分钟

  async initialize() {
    // 启动时检测一次
    await this.scanAIExtensions();
    
    // 启动定时检测
    this.startAIScanTimer();
  }

  private startAIScanTimer(): void {
    this.aiScanTimer = setInterval(async () => {
      console.log('定时扫描AI插件...');
      await this.scanAIExtensions();
    }, this.AI_SCAN_INTERVAL);
  }

  private stopAIScanTimer(): void {
    if (this.aiScanTimer) {
      clearInterval(this.aiScanTimer);
      this.aiScanTimer = null;
    }
  }

  dispose(): void {
    this.stopAIScanTimer(); // 确保清理定时器
    // ... 其他清理代码
  }
}
```

### 2. 扩展AI插件黑名单
```typescript
// 新的扩展插件列表
const AI_EXTENSIONS = [
  // GitHub Copilot系列
  'github.copilot',
  'github.copilot-chat',
  'microsoft.github-copilot-labs',
  
  // Claude系列
  'saoudrizwan.claude-dev',           // Cline (Claude Dev)
  'anthropic.claude-3-vscode',
  
  // 其他主流AI工具
  'tabnine.tabnine-vscode',
  'codeium.codeium',
  'cursor.cursor-vscode',
  'continue.continue',
  'sourcegraph.cody-ai',
  'amazon.q-developer',
  'amazonwebservices.aws-toolkit-vscode',
  
  // 新兴AI工具
  'windsurf.windsurf-cascade',
  'openai.openai-vscode',
  'google.duet-ai',
  'meta.code-llama',
  'kite.kite',
  'blackbox.blackbox-ai',
  // ... 更多插件
];
```

### 3. 移除手动检测命令
```typescript
// package.json - 移除的命令
// {
//   "command": "aicodingtracker.scanAIExtensions",
//   "title": "Scan AI Extensions",
//   "category": "AI Coding Tracker"
// }

// extension.ts - 移除的命令注册
// vscode.commands.registerCommand('aicodingtracker.scanAIExtensions', () => tracker.scanAIExtensions())
```

## 📊 检测指标和警报

### 检测阈值
- **代码突增**：单次保存增加 >50 行代码
- **时间异常**：30秒内增加 >100 行代码
- **复杂度不匹配**：编程时间与代码复杂度严重不符

### 警报级别
- 🔴 **高风险**：AI插件 + 代码异常增长
- 🟡 **中风险**：单一异常指标超过阈值
- 🔵 **信息**：正常编程活动记录

## 📝 API 接口

### 数据上报接口
```
POST /api/v1/coding-report
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "uuid",
  "userId": "student_id",
  "timestamp": "2024-12-19T10:30:00Z",
  "aiExtensions": ["github.copilot"],
  "alerts": [
    {
      "type": "rapid_code_increase",
      "severity": "high",
      "details": {
        "filePath": "/path/to/file.js",
        "lineDiff": 85,
        "timeDiff": 15000
      },
      "timestamp": "2024-12-19T10:25:00Z"
    }
  ],
  "statistics": {
    "totalFiles": 5,
    "totalLines": 1250,
    "editingTime": 3600000,
    "suspiciousEvents": 2
  }
}
```

### 响应格式
```json
{
  "status": "success",
  "message": "Data received successfully", 
  "reportId": "report_uuid",
  "timestamp": "2024-12-19T10:30:00Z"
}
```

## 🚀 开发计划

### Phase 1: 基础功能 [✅ 完全完成 - 2024.12.19]
- [x] ✅ 插件框架搭建
  - [x] package.json配置完成 (7个配置项)
  - [x] TypeScript编译环境
  - [x] 命令注册和事件处理
  - [x] 状态栏集成
- [x] ✅ AI插件检测  
  - [x] 9个主要AI插件检测
  - [x] 实时警告通知
  - [x] 手动重新扫描
- [x] ✅ 文件夹选择配置
  - [x] 首次选择界面
  - [x] 持久化存储
  - [x] 随时重新选择
- [x] ✅ AutoSave完整功能
  - [x] VS Code设置强制启用
  - [x] 快照存储系统到globalStorageUri
  - [x] 版本历史追踪和管理

### Phase 2: 监控分析 [✅ 基础版本完成 - 2024.12.19]  
- [x] ✅ 代码变化监控
  - [x] 快照存储到globalStorageUri
  - [x] 版本历史管理
  - [x] 文档保存事件监听
  - [x] 会话管理和文件组织
- [x] ✅ 异常检测算法（基础版本）
  - [x] 大量代码突增检测
  - [x] 内容哈希比较
  - [x] 算法具体实现
- [x] ✅ 版本跳跃分析
  - [x] 前后版本对比
  - [x] 时间间隔分析
- [x] ✅ 本地警报系统
  - [x] 实时警告通知
  - [x] 详细信息显示
  - [x] 分级警报机制

### Phase 2.5: AI检测升级 [✅ 已完成 - 2024.12.19]
- [x] ✅ **扩展AI插件黑名单**
  - [x] 将AI_EXTENSIONS从9个扩展到25个主流AI插件
  - [x] 包含Cline、Cursor、Amazon Q等新兴AI工具
  - [x] 更新插件ID映射和显示名称
- [x] ✅ **实现定时自动检测**
  - [x] 使用setInterval每1分钟(60000ms)自动扫描
  - [x] 在initialize()方法中启动定时器
  - [x] 确保定时器在插件卸载时正确清理
- [x] ✅ **移除手动检测接口**
  - [x] 从package.json的commands中移除scanAIExtensions命令
  - [x] 从extension.ts中移除相关命令注册
  - [x] 更新README和状态显示，移除手动扫描相关说明

### Phase 3: 数据上报 [⏳ 待开始]
- [ ] ⏳ HTTP API集成
- [ ] ⏳ 批量上传机制
- [ ] ⏳ 离线缓存功能
- [ ] ⏳ 错误处理机制

### Phase 4: 优化测试 [⏳ 待开始]
- [ ] ⏳ 性能优化
- [ ] ⏳ 用户界面完善
- [ ] ⏳ 全面测试验证

## 📊 当前项目状态 (2024.12.19)

### ✅ 已完成功能
- **插件基础框架** - 完整的VS Code插件架构
- **AI插件检测** - 支持9个主要AI编程助手检测  
- **文件夹监控配置** - 用户友好的选择和配置界面
- **AutoSave完整系统** - VS Code设置配置 + 快照存储系统
- **代码变化监控** - 实时监控和版本历史追踪
- **异常检测算法** - 基础版本的AI使用检测
- **本地警报系统** - 实时警告和详细信息显示
- **状态栏集成** - 实时状态显示和用户交互
- **命令系统** - 完整的命令注册和处理

### 🆕 新增需求列表 (2024.12.19)
- **扩展AI插件检测范围** - 从9个扩展到20+个主流AI工具
- **自动定时检测** - 每5分钟自动扫描，提高检测实时性
- **简化用户界面** - 移除手动检测命令，降低复杂度

### 🎯 核心监控能力已实现
- **快照存储** - 完整的文件版本历史保存到globalStorageUri
- **实时分析** - 每次保存时的代码变化分析
- **异常检测** - 大量代码突增和内容替换检测
- **用户警告** - 实时的可疑活动通知

### 🆕 新增需求 (2024.12.19)
1. **自动定时检测AI插件** - 每5分钟自动扫描一次AI插件
2. **移除手动检测接口** - 取消用户手动重新扫描AI插件的命令
3. **扩展AI插件黑名单** - 增加更多流行的AI编程助手到检测列表

### ⏳ 下一步工作
1. **服务器上报** - HTTP API集成和数据上传功能
2. **高级检测** - 代码复杂度计算和编程模式学习
3. **性能优化** - 大文件处理和存储优化

### 🚀 技术就绪状态
- ✅ 编译环境：无错误，通过TypeScript编译
- ✅ 代码质量：符合ESLint规范，完成代码审查
- ✅ 插件测试：可在VS Code扩展开发主机中运行
- ✅ 用户界面：状态栏和命令面板集成完成
- ✅ 逻辑验证：修复了快照比较和异常检测的关键逻辑问题

### 🔧 代码质量保证 (2024.12.19)
- **逻辑修复**：修复了 getPreviousSnapshot 和异常检测的严重逻辑错误
- **安全增强**：文件名安全处理，防止路径注入攻击
- **内存优化**：大文件内容截断，避免内存泄漏
- **API更新**：使用最新的 fs.promises.rm 替代废弃的 rmdir
- **代码清理**：移除未使用的导入模块

## ✅ 验收标准

### 功能要求
- AI插件检测率 ≥ 90% (当前已达成)
- 代码突增检测准确率 ≥ 85% (算法设计完成)
- 外部复制检测有效性 ≥ 70% (算法设计完成)
- 性能影响 ≤ 5% (轻量级设计)

### 稳定性要求
- 插件正常运行时间 ≥ 99%
- 数据上报成功率 ≥ 95%
- 误报率 ≤ 10%
- 响应时间 ≤ 100ms

---

## 📝 更新日志

### v2.3 - 2024.12.19 新增需求
- 🆕 增加定时AI插件检测需求（每5分钟自动扫描）
- 🆕 扩展AI插件黑名单到20+个主流工具（包含Cline、Cursor等）
- 🆕 移除手动检测AI插件的用户界面命令
- 🆕 新增Phase 2.5开发阶段专门处理AI检测升级
- 🆕 完善技术实现细节和配置说明

---

**文档版本**：v2.3  
**最后更新**：2024.12.19  
**项目类型**：VS Code 插件  
**技术栈**：TypeScript, VS Code Extension API  
**当前状态**：Phase 1 已完成，Phase 2 开发中，Phase 2.5 新增需求待实现