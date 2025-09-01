import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';

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

// 系统AI插件检测相关接口
interface AIPluginReport {
	installedPlugins: string[];     // 所有已安装的AI插件
	totalCount: number;             // 总AI插件数量
	riskLevel: 'low' | 'medium' | 'high'; // 风险等级评估
	detectionMethod: 'filesystem';   // 检测方法标识
	operatingSystem: string;        // 操作系统信息
	pluginDirectory: string;        // 插件目录路径
}

// 插件package.json类型定义
interface PluginPackageJson {
	name?: string;
	displayName?: string;
	description?: string;
	version?: string;
	publisher?: string;
	[key: string]: any;
}

// 系统插件检测器
class SystemPluginDetector {
	private readonly AI_PLUGIN_KEYWORDS = [
		'copilot', 'claude', 'gpt', 'openai', 'tabnine', 
		'codeium', 'cursor', 'ai-coding', 'ai-assistant', 'code-completion',
		'neural', 'machine-learning', 'llm', 'chatgpt'
	];

	private readonly PLUGIN_DIRECTORIES = {
		'win32': path.join(os.homedir(), '.vscode', 'extensions'),     // Windows
		'darwin': path.join(os.homedir(), '.vscode', 'extensions'),   // macOS
		'linux': path.join(os.homedir(), '.vscode', 'extensions')     // Linux
	};

	detectOperatingSystem(): 'windows' | 'macos' | 'linux' | 'unknown' {
		const platform = os.platform();
		switch (platform) {
			case 'win32':
				return 'windows';
			case 'darwin':
				return 'macos';
			case 'linux':
				return 'linux';
			default:
				return 'unknown';
		}
	}

	getPluginDirectory(): string {
		const platform = os.platform();
		return this.PLUGIN_DIRECTORIES[platform as keyof typeof this.PLUGIN_DIRECTORIES] || 
			   path.join(os.homedir(), '.vscode', 'extensions');
	}

	async scanInstalledPlugins(includeKeywordDetection: boolean = true): Promise<string[]> {
		try {
			const pluginDir = this.getPluginDirectory();
			console.log(`扫描插件目录: ${pluginDir}`);

			// 异步检查目录是否存在
			try {
				await fs.promises.access(pluginDir, fs.constants.F_OK);
			} catch {
				console.warn(`插件目录不存在: ${pluginDir}`);
				return [];
			}

			const entries = await fs.promises.readdir(pluginDir);
			const installedAIPlugins: string[] = [];

			for (const entry of entries) {
				const pluginPath = path.join(pluginDir, entry);
				const packageJsonPath = path.join(pluginPath, 'package.json');
				
				try {
					// 检查是否为目录
					const stat = await fs.promises.stat(pluginPath);
					if (!stat.isDirectory()) {
						continue;
					}

					// 异步检查package.json是否存在
					try {
						await fs.promises.access(packageJsonPath, fs.constants.F_OK);
					} catch {
						continue; // package.json不存在，跳过
					}

					const packageData = await fs.promises.readFile(packageJsonPath, 'utf8');
					const pkg = JSON.parse(packageData);
					
					if (this.isAIPlugin(pkg, entry, includeKeywordDetection)) {
						// 优先使用package.json中的name，fallback到目录名
						const pluginId = pkg.name || entry;
						installedAIPlugins.push(pluginId);
						console.log(`发现AI插件: ${pluginId} (目录: ${entry})`);
					}
				} catch (error) {
					// 细化错误处理
					if (error instanceof SyntaxError) {
						console.warn(`插件 ${entry} 的package.json格式无效`);
					} else if (error instanceof Error && error.message.includes('ENOENT')) {
						console.debug(`插件 ${entry} 缺少必要文件`);
					} else {
						console.warn(`扫描插件 ${entry} 时发生错误:`, error);
					}
					continue;
				}
			}
			
			console.log(`文件系统扫描完成，发现 ${installedAIPlugins.length} 个AI插件`);
			return installedAIPlugins;
		} catch (error) {
			console.error('文件系统扫描失败:', error);
			return [];
		}
	}

	private isAIPlugin(packageJson: PluginPackageJson, directoryName: string, enableKeywordDetection: boolean = true): boolean {
		// 1. 优先检查已知AI插件ID
		if (packageJson.name && AI_EXTENSIONS.includes(packageJson.name)) {
			return true;
		}
		
		// 2. 安全的目录名匹配检查（修复Bug #1）
		// VSCode插件目录格式通常是: publisher.name-version
		// 需要精确匹配，避免误判
		const isDirectoryMatch = AI_EXTENSIONS.some(ext => {
			// 精确匹配插件ID
			if (directoryName === ext) {
				return true;
			}
			// 匹配带版本号的目录名：publisher.name-x.x.x
			const versionPattern = new RegExp(`^${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+\\.\\d+\\.\\d+`);
			return versionPattern.test(directoryName);
		});
		
		if (isDirectoryMatch) {
			return true;
		}
		
		// 3. 关键词检测（可选）
		if (enableKeywordDetection) {
			const text = `${packageJson.name || ''} ${packageJson.displayName || ''} ${packageJson.description || ''}`.toLowerCase();
			// 移除目录名检测，避免false positive
			return this.AI_PLUGIN_KEYWORDS.some(keyword => text.includes(keyword));
		}
		
		return false;
	}

	generateDetectionReport(installedPlugins: string[]): AIPluginReport {
		const osType = this.detectOperatingSystem();
		const pluginDir = this.getPluginDirectory();
		
		return {
			installedPlugins,
			totalCount: installedPlugins.length,
			riskLevel: this.calculateRiskLevel(installedPlugins.length),
			detectionMethod: 'filesystem',
			operatingSystem: `${osType} (${os.platform()})`,
			pluginDirectory: pluginDir
		};
	}

	private calculateRiskLevel(count: number): 'low' | 'medium' | 'high' {
		if (count === 0) {
			return 'low';
		}
		if (count <= 2) {
			return 'medium';
		}
		return 'high';
	}
}

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

	// 修复Bug #3: 改进内存清理策略
	private cleanupMemoryIfNeeded(): void {
		if (this.snapshots.size > this.maxFilesInMemory) {
			// 找到快照数量最少的文件进行清理（而不是最旧的）
			let minSnapshotsKey = '';
			let minSnapshotsCount = Infinity;
			
			for (const [key, snapshots] of this.snapshots.entries()) {
				if (snapshots.length < minSnapshotsCount) {
					minSnapshotsCount = snapshots.length;
					minSnapshotsKey = key;
				}
			}
			
			if (minSnapshotsKey) {
				this.snapshots.delete(minSnapshotsKey);
				console.log(`Memory cleaned: Removed snapshots for ${minSnapshotsKey} (${minSnapshotsCount} snapshots)`);
			}
		}
	}

	async cleanupOldSnapshots(): Promise<void> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.maxStorageDays);

			// 修复Bug #4: 检查目录是否存在
			try {
				await fs.promises.access(this.snapshotDir, fs.constants.F_OK);
			} catch {
				console.log('Snapshot directory does not exist yet, skipping cleanup');
				return;
			}

			const entries = await fs.promises.readdir(this.snapshotDir);
			for (const entry of entries) {
				const entryPath = path.join(this.snapshotDir, entry);
				
				try {
					const stats = await fs.promises.stat(entryPath);
					
					if (stats.isDirectory() && stats.mtime < cutoffDate) {
						await fs.promises.rm(entryPath, { recursive: true, force: true });
						console.log(`Cleaned up old snapshot directory: ${entry}`);
					}
				} catch (error) {
					console.warn(`Failed to process entry ${entry}:`, error);
					continue;
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
	
	// AI插件检测系统
	private aiScanTimer: NodeJS.Timeout | null = null;
	private systemPluginDetector: SystemPluginDetector;
	private latestAIReport: AIPluginReport | null = null;
	private lastWarningTimestamp: number = 0;
	private readonly WARNING_THROTTLE_MS = 60000; // 1分钟内最多一次警告
	
	// 修复Bug #2: 添加文档保存处理的并发控制
	private documentSaveQueue: Map<string, Promise<void>> = new Map();

	constructor(private context: vscode.ExtensionContext) {
		this.config = vscode.workspace.getConfiguration('aiCodingTracker');
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'aicodingtracker.showStatus';
		this.statusBarItem.show();
		
		// 初始化快照管理器
		this.snapshotManager = new SnapshotManager(context);
		
		// 初始化系统插件检测器
		this.systemPluginDetector = new SystemPluginDetector();
		
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
		const reportInterval = this.config.get<number>('reportInterval', 60000);
		const alertThreshold = this.config.get<number>('alertThreshold', 50);
		const aiScanInterval = this.config.get<number>('aiScanInterval', 300000);
		const timeThreshold = this.config.get<number>('timeThreshold', 30000);
		const characterThreshold = this.config.get<number>('characterThreshold', 500);

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

		if (timeThreshold < 5000 || timeThreshold > 300000) { // 5秒到5分钟
			console.warn(`Invalid timeThreshold: ${timeThreshold}. Using default.`);
			vscode.window.showWarningMessage('aiCodingTracker.timeThreshold 配置无效，建议设置在 5000 到 300000 之间。');
		}

		if (characterThreshold < 100 || characterThreshold > 10000) { // 100到10000字符
			console.warn(`Invalid characterThreshold: ${characterThreshold}. Using default.`);
			vscode.window.showWarningMessage('aiCodingTracker.characterThreshold 配置无效，建议设置在 100 到 10000 之间。');
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
		const enableFileSystemScan = this.config.get<boolean>('enableFileSystemScan', true);

		// 检查是否启用文件系统扫描
		if (!enableFileSystemScan) {
			console.log('⚠️ 文件系统扫描已禁用，跳过AI插件检测');
			return;
		}

		this.aiScanTimer = setInterval(async () => {
			try {
				console.log('🔍 定时扫描AI插件...');
				await this.scanAIExtensions();
				this.updateStatusBar();
			} catch (error) {
				console.error('定时AI插件扫描失败:', error);
				// 修复Bug #6: 在严重错误时停止定时器，防止状态不一致
				if (error instanceof Error && error.message.includes('FATAL')) {
					console.error('Fatal error detected, stopping AI scan timer');
					this.stopAIScanTimer();
				}
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

	// AI插件检测功能（文件系统级扫描）
	async scanAIExtensions(): Promise<string[]> {
		try {
			// 修复Bug #5: 移除重复的配置检查（在startAIScanTimer中已检查）
			console.log('🔍 开始文件系统级AI插件扫描...');
			
			// 检测操作系统
			const osType = this.systemPluginDetector.detectOperatingSystem();
			const pluginDir = this.systemPluginDetector.getPluginDirectory();
			console.log(`操作系统: ${osType}, 插件目录: ${pluginDir}`);
			
			// 扫描已安装的AI插件
			const includeKeywordDetection = this.config.get<boolean>('includeKeywordDetection', true);
			const installedPlugins = await this.systemPluginDetector.scanInstalledPlugins(includeKeywordDetection);
			
			// 生成检测报告
			this.latestAIReport = this.systemPluginDetector.generateDetectionReport(installedPlugins);
			
			// 更新检测到的AI插件列表
			this.detectedAIExtensions = installedPlugins;
			
			// 显示检测结果（防止频繁警告）
			if (installedPlugins.length > 0) {
				const riskLevel = this.latestAIReport.riskLevel;
				const riskEmoji = riskLevel === 'high' ? '🔴' : riskLevel === 'medium' ? '🟡' : '🔵';
				
				// 检查是否需要显示警告（防止频繁弹窗）
				const now = Date.now();
				const shouldShowWarning = now - this.lastWarningTimestamp > this.WARNING_THROTTLE_MS;
				
				if (shouldShowWarning || riskLevel === 'high') {
					this.lastWarningTimestamp = now;
					vscode.window.showWarningMessage(
						`${riskEmoji} 检测到 ${installedPlugins.length} 个已安装的AI编程插件 (${riskLevel} 风险级别): ${installedPlugins.slice(0, 3).join(', ')}${installedPlugins.length > 3 ? '...' : ''}`
					);
				}
			} else {
				console.log('✅ 未检测到AI插件');
			}

			return installedPlugins;
		} catch (error) {
			console.error('AI插件扫描失败:', error);
			vscode.window.showErrorMessage(`AI插件扫描失败: ${error instanceof Error ? error.message : '未知错误'}`);
			return [];
		}
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

	// 文档保存事件处理（修复Bug #2: 竞态条件）
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

			const filePath = document.uri.fsPath;
			const relativePath = this.snapshotManager.getRelativePath(filePath, this.monitoredFolder);
			
			// 防止并发处理同一文件的保存事件
			if (this.documentSaveQueue.has(relativePath)) {
				console.log(`Document save already in progress for: ${relativePath}`);
				return;
			}

			console.log(`Document saved: ${filePath}`);
			
			// 创建处理Promise并加入队列
			const processingPromise = this.processDocumentSave(document, relativePath);
			this.documentSaveQueue.set(relativePath, processingPromise);
			
			try {
				await processingPromise;
			} finally {
				// 确保从队列中移除
				this.documentSaveQueue.delete(relativePath);
			}
			
		} catch (error) {
			console.error('Error handling document save:', error);
			// 通知用户但不中断工作流程
			vscode.window.showErrorMessage(`监控系统错误: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}
	
	private async processDocumentSave(document: vscode.TextDocument, relativePath: string): Promise<void> {
		// 获取之前的快照
		const previousSnapshot = this.snapshotManager.getPreviousSnapshot(relativePath);
		
		// 创建新快照
		const snapshot = await this.snapshotManager.createSnapshot(document, this.monitoredFolder);
		
		// 如果有之前的快照，进行变化分析
		if (previousSnapshot) {
			this.analyzeCodeChange(previousSnapshot, snapshot);
		} else {
			console.log(`First snapshot for file: ${relativePath}`);
		}
		
		console.log(`Snapshot created: ${snapshot.id}`);
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
			
			// 基础异常检测 - 传递已计算的值避免重复计算
			if (this.isChangesSuspicious(previous, current, timeDiff, lineDiff, charDiff)) {
				this.handleSuspiciousChange(previous, current, timeDiff, lineDiff, charDiff);
			}
		} catch (error) {
			console.error('Error in code change analysis:', error);
		}
	}

	// 基础异常检测
	private isChangesSuspicious(previous: CodeSnapshot, current: CodeSnapshot, timeDiff: number, lineDiff: number, charDiff: number): boolean {
		// 从配置中读取阈值
		const alertThreshold = this.config.get<number>('alertThreshold', 50);
		const timeThreshold = this.config.get<number>('timeThreshold', 30000);
		const characterThreshold = this.config.get<number>('characterThreshold', 500);

		// 检测大量代码突增
		if (lineDiff > alertThreshold && timeDiff < timeThreshold) {
			return true;
		}
		
		// 检测内容完全替换（可能是粘贴）
		if (previous.hash !== current.hash && charDiff > characterThreshold) {
			return true;
		}
		
		return false;
	}

	// 处理可疑变化
	private handleSuspiciousChange(previous: CodeSnapshot, current: CodeSnapshot, timeDiff: number, lineDiff: number, charDiff: number): void {
		// 从配置中读取阈值
		const alertThreshold = this.config.get<number>('alertThreshold', 50);
		const timeThreshold = this.config.get<number>('timeThreshold', 30000);
		const characterThreshold = this.config.get<number>('characterThreshold', 500);
		
		let alertType = 'unknown';
		let severity: 'low' | 'medium' | 'high' = 'medium';
		
		// 检测大量代码突增
		if (lineDiff > alertThreshold && timeDiff < timeThreshold) {
			alertType = 'rapid_code_increase';
			severity = 'high';
		}
		// 检测内容完全替换（可能是粘贴大段代码）
		else if (previous.hash !== current.hash && charDiff > characterThreshold) {
			alertType = 'content_replacement';
			severity = 'high';
		}
		
		console.warn(`⚠️ Suspicious activity detected:
			Type: ${alertType}
			Severity: ${severity}
			File: ${current.relativePath}
			Line change: ${lineDiff}
			Time: ${timeDiff}ms`);
		
		// 显示警告给用户
		const changeDescription = alertType === 'rapid_code_increase' 
			? `${lineDiff} 行, ${timeDiff}ms`
			: alertType === 'content_replacement'
			? `${charDiff} 字符替换`
			: `${lineDiff} 行, ${timeDiff}ms`;

		vscode.window.showWarningMessage(
			`检测到可疑代码变化: ${current.relativePath} (${changeDescription})`,
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
		
		// 根据风险等级选择图标和颜色
		let statusIcon = '$(shield)';
		if (this.latestAIReport) {
			switch (this.latestAIReport.riskLevel) {
				case 'high':
					statusIcon = '$(alert)';
					break;
				case 'medium':
					statusIcon = '$(warning)';
					break;
				case 'low':
					statusIcon = '$(check)';
					break;
			}
		}
		
		this.statusBarItem.text = `${statusIcon} AI Tracker: ${aiCount} 已安装 | ${monitorStatus}`;
		
		const osInfo = this.latestAIReport ? this.latestAIReport.operatingSystem : '检测中...';
		const riskLevel = this.latestAIReport ? this.latestAIReport.riskLevel : 'unknown';
		
		this.statusBarItem.tooltip = `
文件系统检测: ${aiCount} 个已安装AI插件
风险等级: ${riskLevel}
操作系统: ${osInfo}
监控状态: ${monitorStatus}
监控文件夹: ${this.monitoredFolder || '未设置'}
快照统计: ${snapshotStats.totalSnapshots} 个快照, ${snapshotStats.totalFiles} 个文件`.trim();
	}

	// 显示状态信息
	showStatus(): void {
		const aiList = this.detectedAIExtensions.length > 0 
			? this.detectedAIExtensions.join('\n- ') 
			: '无';
		
		const snapshotStats = this.snapshotManager.getSnapshotStats();
		const sessionId = this.snapshotManager.getSessionId();
		
		// 文件系统检测详细信息
		const fsDetectionInfo = this.latestAIReport ? `
文件系统检测报告:
- 操作系统: ${this.latestAIReport.operatingSystem}
- 插件目录: ${this.latestAIReport.pluginDirectory}
- 检测方法: ${this.latestAIReport.detectionMethod}
- 风险等级: ${this.latestAIReport.riskLevel}
- 最后扫描: ${new Date().toLocaleString()}` : `
文件系统检测报告:
- 状态: 初始化中...`;

		const statusMessage = `
AI Coding Tracker 状态 (Phase 2.8):

已安装的AI插件 (${this.detectedAIExtensions.length}):
- ${aiList}
${fsDetectionInfo}

监控状态: ${this.isMonitoring ? '启用' : '禁用'}
监控文件夹: ${this.monitoredFolder || '未设置'}
自动保存: 已启用 (3秒间隔)

快照系统:
- 会话ID: ${sessionId}
- 已创建快照: ${snapshotStats.totalSnapshots} 个
- 监控文件: ${snapshotStats.totalFiles} 个
- 存储位置: globalStorageUri/snapshots

🔍 扫描设置:
- AI插件扫描间隔: 1分钟
- 检测级别: 文件系统级（已安装插件）
- 支持平台: Windows/macOS/Linux
		`.trim();

		vscode.window.showInformationMessage(statusMessage, { modal: true });
	}

	dispose(): void {
		// 停止AI插件定时检测
		this.stopAIScanTimer();
		
		// 清理文档保存队列
		this.documentSaveQueue.clear();
		
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
