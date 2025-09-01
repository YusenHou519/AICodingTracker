import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// AI插件黑名单 - 扩展版本 (20+个主流AI工具)
const AI_EXTENSIONS = [
	// GitHub Copilot系列
	'github.copilot',
	'github.copilot-chat',
	'microsoft.github-copilot-labs',
	
	// Claude系列
	'saoudrizwan.claude-dev',           // Cline (Claude Dev)
	'anthropic.claude-3-vscode',        // Claude 3官方插件
	
	// 主流AI编程助手
	'tabnine.tabnine-vscode',           // Tabnine
	'codeium.codeium',                  // Codeium
	'cursor.cursor-vscode',             // Cursor AI Assistant
	'continue.continue',                // Continue
	'sourcegraph.cody-ai',              // Sourcegraph Cody
	
	// 云厂商AI工具
	'amazonwebservices.aws-toolkit-vscode', // AWS Toolkit
	'amazon.q-developer',               // Amazon Q Developer
	'visualstudioexptteam.vscodeintellicode', // IntelliCode
	'google.duet-ai',                   // Google Duet AI
	
	// 新兴AI工具
	'windsurf.windsurf-cascade',        // Windsurf Cascade
	'openai.openai-vscode',             // OpenAI官方插件
	'meta.code-llama',                  // Meta Code Llama
	'kite.kite',                        // Kite AI
	'deepcode.deepcode',                // DeepCode AI
	'intellij.ai-assistant',            // IntelliJ AI Assistant
	'stability.stablecode',             // StableCode
	'cohere.cohere-vscode',             // Cohere AI
	'ai-toolkit.ai-toolkit',            // AI Toolkit
	'blackbox.blackbox-ai'              // BlackBox AI
];

// 快照数据结构
interface CodeSnapshot {
	id: string;
	timestamp: Date;
	sessionId: string;
	filePath: string;
	relativePath: string;
	content: string;
	lineCount: number;
	characterCount: number;
	hash: string;
	metadata: {
		fileSize: number;
		language: string;
		encoding: string;
	};
}

// 快照管理器
class SnapshotManager {
	private snapshotDir: string;
	private sessionId: string;
	private snapshots: Map<string, CodeSnapshot[]> = new Map();
	private readonly maxSnapshotsPerFile = 50;
	private readonly maxFilesInMemory = 200; // 内存中最多保留200个文件的快照
	private maxStorageDays = 7;

	constructor(private context: vscode.ExtensionContext) {
		if (!context.globalStorageUri) {
			throw new Error('Extension context globalStorageUri is not available');
		}
		this.snapshotDir = path.join(context.globalStorageUri.fsPath, 'snapshots');
		this.sessionId = this.generateSessionId();
		// 异步初始化将在外部调用
	}

	public async initializeAsync(): Promise<void> {
		try {
			await this.ensureDirectoryExists();
		} catch (error) {
			console.error('Failed to initialize snapshot manager:', error);
			throw error;
		}
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	}

	private async ensureDirectoryExists(): Promise<void> {
		try {
			// 使用异步文件操作
			await fs.promises.mkdir(this.snapshotDir, { recursive: true });
			
			// 创建今日目录
			const todayDir = path.join(this.snapshotDir, this.getTodayString());
			await fs.promises.mkdir(todayDir, { recursive: true });

			// 创建会话目录
			const sessionDir = path.join(todayDir, this.sessionId);
			await fs.promises.mkdir(sessionDir, { recursive: true });
		} catch (error) {
			console.error('Failed to create snapshot directories:', error);
			throw error;
		}
	}

	private getTodayString(): string {
		return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
	}

	private generateContentHash(content: string): string {
		return crypto.createHash('md5').update(content).digest('hex');
	}

	getRelativePath(filePath: string, monitoredFolder: string): string {
		if (!filePath || !monitoredFolder) {
			throw new Error('Invalid file path or monitored folder provided');
		}
		try {
			return path.relative(monitoredFolder, filePath);
		} catch (error) {
			console.error('Error calculating relative path:', error);
			// 返回绝对路径作为备选
			return path.basename(filePath);
		}
	}

	async createSnapshot(document: vscode.TextDocument, monitoredFolder: string): Promise<CodeSnapshot> {
		if (!document || !document.uri || !document.uri.fsPath) {
			throw new Error('Invalid document provided to createSnapshot');
		}
		if (!monitoredFolder || typeof monitoredFolder !== 'string') {
			throw new Error('Invalid monitoredFolder provided to createSnapshot');
		}

		this.cleanupMemoryIfNeeded(); // 添加内存清理检查

		const content = document.getText();
		const hash = this.generateContentHash(content);
		const relativePath = this.getRelativePath(document.uri.fsPath, monitoredFolder);

		const snapshot: CodeSnapshot = {
			id: `${this.sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
			timestamp: new Date(),
			sessionId: this.sessionId,
			filePath: document.uri.fsPath,
			relativePath: relativePath,
			content: content,
			lineCount: document.lineCount,
			characterCount: content.length,
			hash: hash,
			metadata: {
				fileSize: Buffer.byteLength(content, 'utf8'),
				language: document.languageId,
				encoding: 'utf8'
			}
		};

		// 保存到内存
		const fileSnapshots = this.snapshots.get(relativePath) || [];
		fileSnapshots.push(snapshot);

		// 限制每个文件的快照数量
		if (fileSnapshots.length > this.maxSnapshotsPerFile) {
			fileSnapshots.shift(); // 移除最老的快照
		}

		this.snapshots.set(relativePath, fileSnapshots);

		// 保存到磁盘
		await this.saveSnapshotToDisk(snapshot);

		return snapshot;
	}

	private async saveSnapshotToDisk(snapshot: CodeSnapshot): Promise<void> {
		try {
			const todayDir = path.join(this.snapshotDir, this.getTodayString());
			const sessionDir = path.join(todayDir, this.sessionId);
			// 安全的文件名处理：移除所有特殊字符
			const safeFileName = snapshot.relativePath
				.replace(/[/\\:*?"<>|]/g, '_')
				.replace(/\s+/g, '_')
				.replace(/\.+/g, '_');
			const fileName = `${safeFileName}_${snapshot.id}.json`;
			const filePath = path.join(sessionDir, fileName);

			// 简化快照数据（不保存完整内容到磁盘，只保存元数据）
			const diskSnapshot = {
				...snapshot,
				content: snapshot.content.length > 1000 ? 
					snapshot.content.substring(0, 1000) + '...[truncated]' : 
					snapshot.content
			};

			// 释放大文件内容，避免内存泄漏
			if (snapshot.content.length > 10000) {
				snapshot.content = snapshot.content.substring(0, 1000) + '...[memory_optimized]';
			}

			await fs.promises.writeFile(filePath, JSON.stringify(diskSnapshot, null, 2));
		} catch (error) {
			console.error('Failed to save snapshot to disk:', error);
			// 抛出错误，而不是静默处理
			throw new Error(`Failed to save snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	getSnapshots(relativePath: string): CodeSnapshot[] {
		return this.snapshots.get(relativePath) || [];
	}

	getPreviousSnapshot(relativePath: string): CodeSnapshot | null {
		const snapshots = this.getSnapshots(relativePath);
		// 返回最后一个快照（如果存在）
		return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
	}

	// 新增：清理内存中过多的快照
	private cleanupMemoryIfNeeded(): void {
		if (this.snapshots.size > this.maxFilesInMemory) {
			// 删除最旧的文件记录（基于Map的插入顺序）
			const oldestKey = this.snapshots.keys().next().value;
			if (oldestKey) {
				this.snapshots.delete(oldestKey);
				console.log(`Memory cleaned: Removed oldest file snapshots for ${oldestKey}`);
			}
		}
	}

	async cleanupOldSnapshots(): Promise<void> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.maxStorageDays);

			const entries = await fs.promises.readdir(this.snapshotDir);
			for (const entry of entries) {
				const entryPath = path.join(this.snapshotDir, entry);
				const stats = await fs.promises.stat(entryPath);
				
				if (stats.isDirectory() && stats.mtime < cutoffDate) {
					await fs.promises.rm(entryPath, { recursive: true, force: true });
					console.log(`Cleaned up old snapshot directory: ${entry}`);
				}
			}
		} catch (error) {
			console.error('Failed to cleanup old snapshots:', error);
		}
	}

	getSessionId(): string {
		return this.sessionId;
	}

	getSnapshotStats(): { totalSnapshots: number; totalFiles: number } {
		let totalSnapshots = 0;
		this.snapshots.forEach(snapshots => {
			totalSnapshots += snapshots.length;
		});

		return {
			totalSnapshots,
			totalFiles: this.snapshots.size
		};
	}
}

// 全局状态管理
class AICodingTracker {
	private statusBarItem: vscode.StatusBarItem;
	private config: vscode.WorkspaceConfiguration;
	private monitoredFolder: string = '';
	private detectedAIExtensions: string[] = [];
	private isMonitoring: boolean = false;
	private snapshotManager: SnapshotManager;
	private disposables: vscode.Disposable[] = [];
	
	// 定时AI插件检测
	private aiScanTimer: NodeJS.Timeout | null = null;

	constructor(private context: vscode.ExtensionContext) {
		this.config = vscode.workspace.getConfiguration('aiCodingTracker');
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'aicodingtracker.showStatus';
		this.statusBarItem.show();
		
		// 初始化快照管理器
		this.snapshotManager = new SnapshotManager(context);
		
		this.updateStatusBar();
	}

	async initialize() {
		console.log('AI Coding Tracker is now active!');
		
		try {
			// 等待快照管理器初始化完成
			await this.snapshotManager.initializeAsync();
			
			// 清理旧快照
			await this.snapshotManager.cleanupOldSnapshots();
			
			// 验证配置
			this.validateConfig();

			// 检测AI插件
			await this.scanAIExtensions();
			
			// 设置监控文件夹
			await this.setupMonitoredFolder();
			
			// 启用AutoSave
			await this.enableAutoSave();
			
			// 开始监控
			this.startMonitoring();
			
			// 启动定时AI插件检测
			this.startAIScanTimer();
			
			this.updateStatusBar();
		} catch (error) {
			console.error('Failed to initialize AI Coding Tracker:', error);
			vscode.window.showErrorMessage(`AI Coding Tracker 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 新增：验证配置
	private validateConfig(): void {
		const reportInterval = this.config.get<number>('reportInterval', 300000);
		const alertThreshold = this.config.get<number>('alertThreshold', 50);
		const aiScanInterval = this.config.get<number>('aiScanInterval', 300000);

		if (reportInterval < 60000 || reportInterval > 3600000) { // 1分钟到1小时
			console.warn(`Invalid reportInterval: ${reportInterval}. Using default.`);
			vscode.window.showWarningMessage('aiCodingTracker.reportInterval 配置无效，建议设置在 60000 到 3600000 之间。');
		}

		if (alertThreshold < 10 || alertThreshold > 1000) {
			console.warn(`Invalid alertThreshold: ${alertThreshold}. Using default.`);
			vscode.window.showWarningMessage('aiCodingTracker.alertThreshold 配置无效，建议设置在 10 到 1000 之间。');
		}

		if (aiScanInterval < 60000 || aiScanInterval > 3600000) { // 1分钟到1小时
			console.warn(`Invalid aiScanInterval: ${aiScanInterval}. Using default.`);
			vscode.window.showWarningMessage('aiCodingTracker.aiScanInterval 配置无效，建议设置在 60000 到 3600000 之间。');
		}
	}

	// 定时器管理方法
	private startAIScanTimer(): void {
		// 确保不会重复创建定时器
		if (this.aiScanTimer) {
			console.warn('AI scan timer already running, skipping start.');
			return;
		}

		// 从配置中读取扫描间隔
		const scanInterval = this.config.get<number>('aiScanInterval', 300000); // 默认5分钟

		this.aiScanTimer = setInterval(async () => {
			try {
				console.log('🔍 定时扫描AI插件...');
				await this.scanAIExtensions();
				this.updateStatusBar();
			} catch (error) {
				console.error('定时AI插件扫描失败:', error);
			}
		}, scanInterval);
		
		console.log(`✅ AI插件定时检测已启动，间隔: ${scanInterval / 1000}秒`);
	}

	private stopAIScanTimer(): void {
		if (this.aiScanTimer) {
			clearInterval(this.aiScanTimer);
			this.aiScanTimer = null;
			console.log('🛑 AI插件定时检测已停止');
		}
	}

	// AI插件检测功能
	async scanAIExtensions(): Promise<string[]> {
		const allExtensions = vscode.extensions.all;
		const foundAIExtensions: string[] = [];

		for (const extension of allExtensions) {
			if (AI_EXTENSIONS.includes(extension.id)) {
				foundAIExtensions.push(extension.id);
				console.log(`Detected AI Extension: ${extension.id}`);
			}
		}

		this.detectedAIExtensions = foundAIExtensions;
		
		if (foundAIExtensions.length > 0) {
			vscode.window.showWarningMessage(
				`检测到 ${foundAIExtensions.length} 个AI编程插件: ${foundAIExtensions.join(', ')}`
			);
		}

		return foundAIExtensions;
	}

	// 文件夹选择配置功能
	async setupMonitoredFolder(): Promise<void> {
		let monitoredPath = this.config.get<string>('monitoredFolder', '');
		
		if (!monitoredPath) {
			const result = await vscode.window.showInformationMessage(
				'首次运行需要选择要监控的工作文件夹',
				'选择文件夹',
				'稍后设置'
			);
			
			if (result === '选择文件夹') {
				await this.selectMonitorFolder();
			}
		} else {
			this.monitoredFolder = monitoredPath;
			console.log(`Using configured monitored folder: ${monitoredPath}`);
		}
	}

	async selectMonitorFolder(): Promise<void> {
		const options: vscode.OpenDialogOptions = {
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: '选择要监控的工作文件夹'
		};

		const folderUri = await vscode.window.showOpenDialog(options);
		if (folderUri && folderUri[0]) {
			this.monitoredFolder = folderUri[0].fsPath;
			await this.config.update('monitoredFolder', this.monitoredFolder, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`已设置监控文件夹: ${this.monitoredFolder}`);
			console.log(`Monitored folder set to: ${this.monitoredFolder}`);
		}
	}

	// AutoSave强制启用功能
	async enableAutoSave(): Promise<void> {
		const filesConfig = vscode.workspace.getConfiguration('files');
		const currentAutoSave = filesConfig.get('autoSave');
		const currentDelay = filesConfig.get('autoSaveDelay');

		if (currentAutoSave !== 'afterDelay' || currentDelay !== 3000) {
			try {
				await filesConfig.update('autoSave', 'afterDelay', vscode.ConfigurationTarget.Workspace);
				await filesConfig.update('autoSaveDelay', 3000, vscode.ConfigurationTarget.Workspace);
				console.log('AutoSave enabled: afterDelay with 3000ms');
				vscode.window.showInformationMessage('已启用自动保存功能 (3秒间隔)');
			} catch (error) {
				console.error('Failed to enable AutoSave:', error);
				vscode.window.showErrorMessage('启用自动保存失败');
			}
		} else {
			console.log('AutoSave already configured correctly');
		}
	}

	// 开始监控
	startMonitoring(): void {
		if (!this.monitoredFolder) {
			console.log('No monitored folder configured, monitoring disabled');
			return;
		}

		this.isMonitoring = true;
		console.log(`Started monitoring folder: ${this.monitoredFolder}`);

		// 监听文档保存事件
		const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
			if (document.uri.fsPath.startsWith(this.monitoredFolder)) {
				this.onDocumentSaved(document);
			}
		});

		this.disposables.push(saveListener);
	}

	// 文档保存事件处理
	private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
		try {
			// 验证必要条件
			if (!this.monitoredFolder) {
				console.warn('No monitored folder set, skipping document save handling');
				return;
			}

			if (!document || !document.uri || !document.uri.fsPath) {
				console.warn('Invalid document, skipping snapshot creation');
				return;
			}

			console.log(`Document saved: ${document.uri.fsPath}`);
			
			// 先获取相对路径和之前的快照
			const relativePath = this.snapshotManager.getRelativePath(document.uri.fsPath, this.monitoredFolder);
			const previousSnapshot = this.snapshotManager.getPreviousSnapshot(relativePath);
			
			// 然后创建新快照
			const snapshot = await this.snapshotManager.createSnapshot(document, this.monitoredFolder);
			
			// 如果有之前的快照，进行变化分析
			if (previousSnapshot) {
				this.analyzeCodeChange(previousSnapshot, snapshot);
			} else {
				console.log(`First snapshot for file: ${relativePath}`);
			}
			
			console.log(`Snapshot created: ${snapshot.id}`);
			
		} catch (error) {
			console.error('Error handling document save:', error);
			// 通知用户但不中断工作流程
			vscode.window.showErrorMessage(`监控系统错误: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	// 代码变化分析
	private analyzeCodeChange(previous: CodeSnapshot, current: CodeSnapshot): void {
		try {
			if (!previous || !current) {
				console.warn('Invalid snapshots provided for analysis');
				return;
			}

			const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
			const lineDiff = current.lineCount - previous.lineCount;
			const charDiff = current.characterCount - previous.characterCount;
			
			// 防止时间差异为负数或无效
			if (timeDiff < 0) {
				console.warn('Invalid time difference detected, skipping analysis');
				return;
			}

			console.log(`Code change detected:
				- Time diff: ${timeDiff}ms
				- Line diff: ${lineDiff}
				- Char diff: ${charDiff}
				- File: ${current.relativePath}`);
			
			// 基础异常检测
			if (this.isChangesSuspicious(previous, current)) {
				this.handleSuspiciousChange(previous, current);
			}
		} catch (error) {
			console.error('Error in code change analysis:', error);
		}
	}

	// 基础异常检测
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

	// 处理可疑变化
	private handleSuspiciousChange(previous: CodeSnapshot, current: CodeSnapshot): void {
		const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
		const lineDiff = current.lineCount - previous.lineCount;
		
		let alertType = 'unknown';
		let severity: 'low' | 'medium' | 'high' = 'medium';
		
		if (lineDiff > 50 && timeDiff < 30000) {
			alertType = 'rapid_code_increase';
			severity = 'high';
		}
		
		console.warn(`⚠️ Suspicious activity detected:
			Type: ${alertType}
			Severity: ${severity}
			File: ${current.relativePath}
			Line change: ${lineDiff}
			Time: ${timeDiff}ms`);
		
		// 显示警告给用户
		vscode.window.showWarningMessage(
			`检测到可疑代码变化: ${current.relativePath} (${lineDiff} 行, ${timeDiff}ms)`,
			'查看详情'
		).then(selection => {
			if (selection === '查看详情') {
				this.showChangeDetails(previous, current);
			}
		});
	}

	// 显示变化详情
	private showChangeDetails(previous: CodeSnapshot, current: CodeSnapshot): void {
		const details = `
文件变化详情:

文件: ${current.relativePath}
时间: ${current.timestamp.toLocaleString()}
会话: ${current.sessionId}

变化统计:
- 行数变化: ${previous.lineCount} → ${current.lineCount} (${current.lineCount - previous.lineCount})
- 字符变化: ${previous.characterCount} → ${current.characterCount} (${current.characterCount - previous.characterCount})
- 时间间隔: ${current.timestamp.getTime() - previous.timestamp.getTime()}ms
- 内容哈希: ${current.hash}

语言: ${current.metadata.language}
文件大小: ${current.metadata.fileSize} bytes
		`.trim();
		
		vscode.window.showInformationMessage(details, { modal: true });
	}

	// 更新状态栏
	private updateStatusBar(): void {
		const aiCount = this.detectedAIExtensions.length;
		const monitorStatus = this.isMonitoring ? '监控中' : '未监控';
		const snapshotStats = this.snapshotManager.getSnapshotStats();
		
		this.statusBarItem.text = `$(shield) AI Tracker: ${aiCount} AI插件 | ${monitorStatus}`;
		this.statusBarItem.tooltip = `检测到 ${aiCount} 个AI插件\n监控状态: ${monitorStatus}\n监控文件夹: ${this.monitoredFolder || '未设置'}\n快照统计: ${snapshotStats.totalSnapshots} 个快照, ${snapshotStats.totalFiles} 个文件`;
	}

	// 显示状态信息
	showStatus(): void {
		const aiList = this.detectedAIExtensions.length > 0 
			? this.detectedAIExtensions.join('\n- ') 
			: '无';
		
		const snapshotStats = this.snapshotManager.getSnapshotStats();
		const sessionId = this.snapshotManager.getSessionId();
		
		const statusMessage = `
AI Coding Tracker 状态:

检测到的AI插件 (${this.detectedAIExtensions.length}):
- ${aiList}

监控状态: ${this.isMonitoring ? '启用' : '禁用'}
监控文件夹: ${this.monitoredFolder || '未设置'}
自动保存: 已启用 (3秒间隔)

快照系统:
- 会话ID: ${sessionId}
- 已创建快照: ${snapshotStats.totalSnapshots} 个
- 监控文件: ${snapshotStats.totalFiles} 个
- 存储位置: globalStorageUri/snapshots
		`.trim();

		vscode.window.showInformationMessage(statusMessage, { modal: true });
	}

	dispose(): void {
		// 停止AI插件定时检测
		this.stopAIScanTimer();
		
		this.statusBarItem.dispose();
		// 释放所有已注册的监听器
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];
	}
}

let tracker: AICodingTracker;

export async function activate(context: vscode.ExtensionContext) {
	tracker = new AICodingTracker(context);
	
	// 注册命令
	const commands = [
		vscode.commands.registerCommand('aicodingtracker.selectMonitorFolder', () => tracker.selectMonitorFolder()),
		vscode.commands.registerCommand('aicodingtracker.showStatus', () => tracker.showStatus())
	];

	commands.forEach(command => context.subscriptions.push(command));
	context.subscriptions.push(tracker);

	// 初始化插件
	await tracker.initialize();
}

export function deactivate() {
	if (tracker) {
		tracker.dispose();
	}
}
