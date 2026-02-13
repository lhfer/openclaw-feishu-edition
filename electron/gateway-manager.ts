import { ChildProcess, spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { ConfigManager } from '../core/config-manager';

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error';
export type EngineStatus = 'not_installed' | 'installing' | 'installed' | 'install_error';

export interface GatewayState {
  status: GatewayStatus;
  pid?: number;
  uptime?: number;
  error?: string;
  feishuConnected: boolean;
  feishuDetail?: string;        // 飞书连接的详细信息/原因
  healthCheckDetail?: string;   // 最近一次健康检查的原始响应
  modelConfigured: boolean;
  engineStatus: EngineStatus;
  engineVersion?: string;
  enginePath?: string;
  recentLogs?: string[];        // 最近的 Gateway 日志（UI 展示用）
}

export interface InstallProgress {
  phase: string;       // 'checking' | 'downloading' | 'installing' | 'done' | 'error'
  message: string;
  percent?: number;
}

type StatusListener = (state: GatewayState) => void;
type InstallListener = (progress: InstallProgress) => void;

/**
 * 获取 Electron 打包后的 Resources 目录路径
 * 开发模式下返回项目根目录
 */
function getResourcesPath(): string {
  // Electron 打包后: process.resourcesPath 指向 .app/Contents/Resources/
  if (process.resourcesPath && !process.resourcesPath.includes('node_modules/electron')) {
    return process.resourcesPath;
  }
  // 开发模式: 返回项目根目录
  return path.join(__dirname, '..', '..');
}

/**
 * 获取内置 bundled 目录中的文件路径
 */
function getBundledPath(...segments: string[]): string {
  return path.join(getResourcesPath(), 'bundled', ...segments);
}

/**
 * 检查内置的 Node.js 二进制是否存在
 */
function getBundledNodePath(): string | null {
  const p = getBundledPath('node', 'bin', 'node');
  return fs.existsSync(p) ? p : null;
}

/**
 * 检查内置的 npm 是否存在
 */
function getBundledNpmPath(): string | null {
  const p = getBundledPath('node', 'bin', 'npm');
  return (fs.existsSync(p) || fs.lstatSync(p).isSymbolicLink()) ? p : null;
}

/**
 * 检查内置的 OpenClaw 引擎是否存在
 */
function getBundledOpenClawPath(): string | null {
  const p = getBundledPath('engine', 'node_modules', '.bin', 'openclaw');
  if (fs.existsSync(p)) return p;
  // 也检查非符号链接的版本
  const alt = getBundledPath('engine', 'node_modules', 'openclaw', 'bin', 'openclaw.js');
  return fs.existsSync(alt) ? alt : null;
}

/**
 * 在常见位置搜索可执行文件（系统级回退）
 */
function findExecutable(name: string): string | null {
  // 0. 优先检查 bundled 目录
  if (name === 'node') {
    const bundled = getBundledNodePath();
    if (bundled) return bundled;
  }
  if (name === 'npm') {
    const bundled = getBundledNpmPath();
    if (bundled) return bundled;
  }
  if (name === 'openclaw') {
    const bundled = getBundledOpenClawPath();
    if (bundled) return bundled;
  }

  // 1. 先用 which 查 PATH
  try {
    const result = execSync(`which ${name}`, { encoding: 'utf-8', timeout: 5000 }).trim();
    if (result && fs.existsSync(result)) return result;
  } catch { /* not in PATH */ }

  // 2. 常见 macOS 位置
  const candidates = [
    `/usr/local/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    path.join(os.homedir(), `.volta/bin/${name}`),
    path.join(os.homedir(), `.fnm/node-versions`, '**', `bin/${name}`),
  ];

  for (const p of candidates) {
    if (!p.includes('*') && fs.existsSync(p)) return p;
  }

  // 3. 搜索 nvm 安装的最新版本
  const nvmDir = path.join(os.homedir(), '.nvm/versions/node');
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir).sort().reverse();
      for (const v of versions) {
        const bin = path.join(nvmDir, v, 'bin', name);
        if (fs.existsSync(bin)) return bin;
      }
    } catch { /* ignore */ }
  }

  return null;
}

export class GatewayManager {
  private process: ChildProcess | null = null;
  private state: GatewayState = {
    status: 'stopped',
    feishuConnected: false,
    modelConfigured: false,
    engineStatus: 'not_installed',
  };
  private startTime: number = 0;
  private configManager: ConfigManager;
  private listeners: StatusListener[] = [];
  private installListeners: InstallListener[] = [];
  private healthCheckInterval: NodeJS.Timer | null = null;

  // 引擎安装目录：~/.openclaw/engine
  private engineDir: string;
  // 日志缓冲区（最近 100 行）
  private logBuffer: string[] = [];
  private readonly MAX_LOG_LINES = 100;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.engineDir = path.join(configManager.getConfigDir(), 'engine');
    // 启动时检测引擎
    this.detectEngine();
  }

  // ==================== 引擎管理 ====================

  /**
   * 检测 OpenClaw 引擎是否已安装
   * 优先级：bundled（内置）> 本地安装 > 全局安装
   */
  detectEngine(): { installed: boolean; version?: string; path?: string; source?: string } {
    console.log('[Engine] 检测 OpenClaw 引擎...');

    // 0. 优先检查 bundled（DMG 内置）
    const bundledBin = getBundledOpenClawPath();
    if (bundledBin) {
      const version = this.getEngineVersion(bundledBin);
      console.log(`[Engine] ✅ 找到内置引擎: ${bundledBin} (${version})`);
      this.updateState({
        engineStatus: 'installed',
        engineVersion: version ? `${version} (内置)` : '内置版本',
        enginePath: bundledBin,
      });
      return { installed: true, version, path: bundledBin, source: 'bundled' };
    }

    // 1. 检查本地安装（~/.openclaw/engine/node_modules/.bin/openclaw）
    const localBin = path.join(this.engineDir, 'node_modules', '.bin', 'openclaw');
    if (fs.existsSync(localBin)) {
      const version = this.getEngineVersion(localBin);
      console.log(`[Engine] 找到本地安装: ${localBin} (${version})`);
      this.updateState({
        engineStatus: 'installed',
        engineVersion: version,
        enginePath: localBin,
      });
      return { installed: true, version, path: localBin, source: 'local' };
    }

    // 2. 检查全局安装（PATH / 常见位置）
    const globalBin = findExecutable('openclaw');
    if (globalBin) {
      const version = this.getEngineVersion(globalBin);
      console.log(`[Engine] 找到全局安装: ${globalBin} (${version})`);
      this.updateState({
        engineStatus: 'installed',
        engineVersion: version,
        enginePath: globalBin,
      });
      return { installed: true, version, path: globalBin, source: 'global' };
    }

    console.log('[Engine] 未找到 OpenClaw 引擎');
    this.updateState({ engineStatus: 'not_installed', engineVersion: undefined, enginePath: undefined });
    return { installed: false };
  }

  /**
   * 获取引擎版本号
   * 如果 binPath 是 .js 文件，需要用 node 来执行
   */
  private getEngineVersion(binPath: string): string {
    try {
      let cmd: string;
      if (binPath.endsWith('.js')) {
        // .js 入口文件需要用 node 执行
        const nodeBin = getBundledNodePath() || findExecutable('node') || 'node';
        cmd = `"${nodeBin}" "${binPath}" --version`;
      } else {
        cmd = `"${binPath}" --version`;
      }
      const ver = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 5000,
        env: { ...process.env, PATH: this.buildBundledPath() },
      }).trim();
      return ver || '未知版本';
    } catch {
      return '未知版本';
    }
  }

  /**
   * 构建包含 bundled 目录的 PATH
   */
  private buildBundledPath(): string {
    const dirs: string[] = [];
    const bundledNodeDir = getBundledPath('node', 'bin');
    if (fs.existsSync(bundledNodeDir)) dirs.push(bundledNodeDir);
    const bundledEngineDir = getBundledPath('engine', 'node_modules', '.bin');
    if (fs.existsSync(bundledEngineDir)) dirs.push(bundledEngineDir);
    dirs.push(process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin');
    return dirs.join(':');
  }

  /**
   * 安装 OpenClaw 引擎
   *
   * 策略：
   * 1. 如果 DMG 内置的 bundled/engine 存在 → 直接使用（零网络依赖）
   * 2. 否则使用内置的 bundled/node/bin/npm 安装到 ~/.openclaw/engine/
   * 3. 如果内置 node 也没有 → 回退到系统 npm
   */
  async installEngine(): Promise<{ success: boolean; error?: string }> {
    console.log('[Engine] 开始安装 OpenClaw 引擎...');
    this.updateState({ engineStatus: 'installing' });

    // ====== 策略 1: 检查内置引擎（零网络，最快）======
    const bundledEngine = getBundledOpenClawPath();
    if (bundledEngine) {
      console.log(`[Engine] ✅ 发现内置引擎: ${bundledEngine}`);
      this.emitInstall({ phase: 'installing', message: '正在初始化内置引擎...', percent: 50 });

      const detect = this.detectEngine();
      if (detect.installed) {
        this.emitInstall({ phase: 'done', message: `内置引擎就绪！版本: ${detect.version}`, percent: 100 });
        return { success: true };
      }
    }

    // ====== 策略 2/3: 需要联网安装 ======
    // 优先使用内置 npm，其次系统 npm
    this.emitInstall({ phase: 'checking', message: '正在查找 npm...' });
    const bundledNpm = getBundledNpmPath();
    const systemNpm = findExecutable('npm');
    const npmPath = bundledNpm || systemNpm;

    if (!npmPath) {
      const errMsg = '未找到 npm，且内置引擎不可用。请重新下载安装包。';
      this.emitInstall({ phase: 'error', message: errMsg });
      this.updateState({ engineStatus: 'install_error', error: errMsg });
      return { success: false, error: errMsg };
    }

    // 如果使用的是内置 npm，需要用内置 node 来执行
    const bundledNode = getBundledNodePath();
    console.log(`[Engine] npm 路径: ${npmPath} (${bundledNpm ? '内置' : '系统'})`);

    // 2. 创建引擎目录
    if (!fs.existsSync(this.engineDir)) {
      fs.mkdirSync(this.engineDir, { recursive: true });
    }

    // 3. 初始化 package.json（如果没有的话）
    const pkgPath = path.join(this.engineDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'openclaw-engine', version: '1.0.0', private: true }, null, 2));
    }

    // 4. 用 npm install 安装（使用国内镜像加速）
    this.emitInstall({ phase: 'downloading', message: '正在下载 OpenClaw 引擎（使用国内镜像加速）...', percent: 10 });

    return new Promise((resolve) => {
      const npmArgs = [
        'install',
        'openclaw',
        '--prefix', this.engineDir,
        '--registry', 'https://registry.npmmirror.com',
        '--no-fund',
        '--no-audit',
      ];

      // 如果使用内置 npm，需要通过内置 node 执行
      // npm 本身是个 JS 脚本，需要 node 来运行
      let spawnCmd: string;
      let args: string[];
      const nodeBin = bundledNode || findExecutable('node');

      if (bundledNpm && nodeBin) {
        // 使用内置 node 执行内置 npm
        spawnCmd = nodeBin;
        // npm-cli.js 的实际路径
        const npmCliJs = getBundledPath('node', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
        const npmScript = fs.existsSync(npmCliJs) ? npmCliJs : npmPath;
        args = [npmScript, ...npmArgs];
      } else {
        // 使用系统 npm
        spawnCmd = npmPath;
        args = npmArgs;
      }

      console.log(`[Engine] 执行: ${spawnCmd} ${args.join(' ')}`);

      // 构建 PATH：bundled node/bin 优先
      const extraPaths = [
        path.dirname(spawnCmd),
        ...(bundledNode ? [path.dirname(bundledNode)] : []),
        process.env.PATH || '',
      ].join(':');

      const proc = spawn(spawnCmd, args, {
        cwd: this.engineDir,
        env: {
          ...process.env,
          PATH: extraPaths,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString();
        stdout += line;
        console.log('[Engine npm]', line.trim());
        if (line.includes('added')) {
          this.emitInstall({ phase: 'installing', message: '正在安装依赖包...', percent: 70 });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString();
        stderr += line;
        if (line.includes('WARN')) {
          console.log('[Engine npm warn]', line.trim());
        } else {
          console.log('[Engine npm stderr]', line.trim());
        }
        if (line.includes('idealTree') || line.includes('reify')) {
          this.emitInstall({ phase: 'installing', message: '正在解析依赖树...', percent: 30 });
        }
        if (line.includes('timing')) {
          this.emitInstall({ phase: 'installing', message: '正在安装中...', percent: 50 });
        }
      });

      proc.on('exit', (code) => {
        console.log(`[Engine] npm install 退出，代码: ${code}`);
        if (code === 0) {
          const detect = this.detectEngine();
          if (detect.installed) {
            this.emitInstall({ phase: 'done', message: `安装成功！版本: ${detect.version}`, percent: 100 });
            resolve({ success: true });
          } else {
            const errMsg = 'npm install 成功但未找到 openclaw 可执行文件。';
            this.emitInstall({ phase: 'error', message: errMsg });
            this.updateState({ engineStatus: 'install_error', error: errMsg });
            resolve({ success: false, error: errMsg });
          }
        } else {
          let errMsg = `npm install 失败 (退出码: ${code})`;
          if (stderr.includes('404')) errMsg += '\n\n包 "openclaw" 在 npm 仓库中未找到。';
          else if (stderr.includes('EACCES') || stderr.includes('permission')) errMsg += '\n\n权限不足。';
          else if (stderr.includes('ENETWORK') || stderr.includes('ETIMEDOUT')) errMsg += '\n\n网络连接失败。';
          errMsg += `\n\n详细日志:\n${stderr.slice(-500)}`;
          this.emitInstall({ phase: 'error', message: errMsg });
          this.updateState({ engineStatus: 'install_error', error: errMsg });
          resolve({ success: false, error: errMsg });
        }
      });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        const errMsg = `无法执行 npm: ${err.message}`;
        this.emitInstall({ phase: 'error', message: errMsg });
        this.updateState({ engineStatus: 'install_error', error: errMsg });
        resolve({ success: false, error: errMsg });
      });
    });
  }

  onInstallProgress(listener: InstallListener): () => void {
    this.installListeners.push(listener);
    return () => {
      this.installListeners = this.installListeners.filter((l) => l !== listener);
    };
  }

  private emitInstall(progress: InstallProgress): void {
    for (const listener of this.installListeners) {
      try { listener(progress); } catch { /* ignore */ }
    }
  }

  /**
   * 追加日志到缓冲区
   */
  private pushLog(line: string): void {
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    this.logBuffer.push(`[${ts}] ${line}`);
    if (this.logBuffer.length > this.MAX_LOG_LINES) {
      this.logBuffer = this.logBuffer.slice(-this.MAX_LOG_LINES);
    }
  }

  /**
   * 获取最近的日志（供 IPC 调用）
   */
  getRecentLogs(count: number = 50): string[] {
    return this.logBuffer.slice(-count);
  }

  // ==================== 构建执行环境 ====================

  /**
   * 构建完整 PATH — Electron 打包后 PATH 只有 /usr/bin:/bin 等基础路径
   * 优先放入 bundled 目录，确保使用内置的 node/openclaw
   */
  private buildFullPath(gatewayPath: string): string {
    const dirs = new Set<string>();

    // 0. 最高优先级：bundled 目录
    const bundledNodeDir = getBundledPath('node', 'bin');
    if (fs.existsSync(bundledNodeDir)) dirs.add(bundledNodeDir);
    const bundledEngineDir = getBundledPath('engine', 'node_modules', '.bin');
    if (fs.existsSync(bundledEngineDir)) dirs.add(bundledEngineDir);

    // 1. Gateway 所在目录
    dirs.add(path.dirname(gatewayPath));

    // 2. 系统 node/npm（回退用）
    const nodePath = findExecutable('node');
    if (nodePath) dirs.add(path.dirname(nodePath));

    const npmPath = findExecutable('npm');
    if (npmPath) dirs.add(path.dirname(npmPath));

    // 3. 常见 macOS 位置
    const commonPaths = ['/usr/local/bin', '/opt/homebrew/bin', path.join(os.homedir(), '.local/bin')];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) dirs.add(p);
    }

    const nvmDir = path.join(os.homedir(), '.nvm/versions/node');
    if (fs.existsSync(nvmDir)) {
      try {
        const versions = fs.readdirSync(nvmDir).sort().reverse();
        if (versions.length > 0) dirs.add(path.join(nvmDir, versions[0], 'bin'));
      } catch { /* ignore */ }
    }

    console.log('[Gateway] extra PATH dirs:', Array.from(dirs));
    return Array.from(dirs).join(':');
  }

  /**
   * 构建子进程共享的环境变量
   */
  private buildSharedEnv(gatewayPath: string): Record<string, string> {
    const extraPaths = this.buildFullPath(gatewayPath);
    const fullPATH = extraPaths + ':' + (process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin');
    const configDir = this.configManager.getConfigDir();
    const gatewayToken = this.configManager.getGatewayToken();

    const env: Record<string, string> = {};
    // 只拷贝有值的环境变量（避免 undefined）
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    env['PATH'] = fullPATH;
    // 关键：OPENCLAW_HOME 必须指向用户主目录（~），而非 ~/.openclaw
    // OpenClaw 会在 $OPENCLAW_HOME/.openclaw/openclaw.json 查找配置
    // 如果设成 ~/.openclaw，它会去读 ~/.openclaw/.openclaw/openclaw.json（双重嵌套！）
    env['OPENCLAW_HOME'] = os.homedir();
    env['OPENCLAW_GATEWAY_TOKEN'] = gatewayToken;
    env['NODE_ENV'] = 'production';

    return env;
  }

  // ==================== Gateway 生命周期 ====================

  private getGatewayPath(): string | null {
    if (this.state.enginePath && fs.existsSync(this.state.enginePath)) {
      return this.state.enginePath;
    }
    const detect = this.detectEngine();
    return detect.path || null;
  }

  /**
   * 构建 openclaw CLI 命令字符串
   * 如果 gatewayPath 是 .js 文件，自动加上 node 前缀
   */
  private buildClawCmd(gatewayPath: string, subCmd: string): string {
    if (gatewayPath.endsWith('.js')) {
      const nodeBin = getBundledNodePath() || findExecutable('node') || 'node';
      return `"${nodeBin}" "${gatewayPath}" ${subCmd}`;
    }
    return `"${gatewayPath}" ${subCmd}`;
  }

  /**
   * 执行 shell 命令的辅助方法（带日志）
   */
  private exec(cmd: string, env: Record<string, string>, label: string): string {
    this.pushLog(`[exec] ${label}: ${cmd.slice(0, 120)}`);
    try {
      const out = execSync(cmd, {
        env,
        timeout: 30000,
        encoding: 'utf-8',
        shell: '/bin/bash',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const trimmed = out.trim().slice(0, 2000);
      console.log(`[Gateway] ${label} 输出:`, trimmed);
      if (trimmed) this.pushLog(`[exec] ${label} → ${trimmed.slice(0, 500)}`);
      return out;
    } catch (e: any) {
      const stderr = e?.stderr?.toString?.()?.trim?.() || '';
      const stdout = e?.stdout?.toString?.()?.trim?.() || '';
      console.log(`[Gateway] ${label} 退出码: ${e?.status}, stderr: ${stderr.slice(0, 800)}, stdout: ${stdout.slice(0, 800)}`);
      this.pushLog(`[exec] ${label} 退出码=${e?.status} stderr=${stderr.slice(0, 400)} stdout=${stdout.slice(0, 400)}`);
      return stdout || stderr;
    }
  }

  /**
   * 启动 Gateway
   * 策略：
   * 1. 确保配置文件正确
   * 2. 运行 doctor --fix 启用 feishu channel
   * 3. 停掉 doctor 可能启动的 launchd 服务
   * 4. 自己 spawn gateway 进程（这样能监控 stdout/stderr）
   */
  async start(): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      return;
    }

    const gatewayPath = this.getGatewayPath();
    if (!gatewayPath) {
      this.updateState({
        status: 'error',
        error: 'OpenClaw 引擎未安装。请先点击「安装引擎」按钮。',
        engineStatus: 'not_installed',
      });
      throw new Error('OpenClaw 引擎未安装');
    }

    this.updateState({ status: 'starting', error: undefined });

    try {
      // 确保 openclaw.json 配置文件存在
      this.configManager.ensureNativeConfig();

      const sharedEnv = this.buildSharedEnv(gatewayPath);
      const configDir = this.configManager.getConfigDir();

      // ====== Step 1: 停掉所有已有的 Gateway（launchd 服务 + 端口占用进程）======
      console.log('[Gateway] Step 1: 停掉所有已有 Gateway...');
      this.exec('launchctl bootout gui/$UID/ai.openclaw.gateway 2>/dev/null || true', sharedEnv, 'launchctl bootout');
      this.exec('lsof -ti :18789 | xargs kill -9 2>/dev/null || true', sharedEnv, 'kill port 18789');

      // 等端口释放
      await this.waitForPortRelease(18789, 5000);

      // ====== Step 2: 打印配置文件帮助调试 ======
      const configPath = path.join(configDir, 'openclaw.json');
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const configObj = JSON.parse(configContent);
          const channelsInfo = configObj.channels ? JSON.stringify(configObj.channels, null, 2).slice(0, 800) : '无 channels 配置';
          this.pushLog(`[配置] openclaw.json channels: ${channelsInfo}`);
          console.log('[Gateway] openclaw.json channels:', channelsInfo);
        } catch (e: any) {
          this.pushLog(`[配置] 读取 openclaw.json 失败: ${e.message}`);
        }
      } else {
        this.pushLog(`[配置] openclaw.json 不存在于 ${configPath}`);
      }

      // ====== Step 3: 运行 doctor --fix 启用 feishu channel ======
      console.log('[Gateway] Step 3: doctor --fix...');
      const doctorOut = this.exec(`${this.buildClawCmd(gatewayPath, 'doctor --fix')} 2>&1 || true`, sharedEnv, 'doctor --fix');
      this.pushLog(`[doctor] 完整输出: ${doctorOut.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim().slice(0, 600)}`);

      // ====== Step 4: 创建缺失目录（doctor 报 CRITICAL: Session store dir missing）======
      const sessionDir = path.join(configDir, 'agents', 'main', 'sessions');
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
        this.pushLog(`[配置] 已创建缺失目录: ${sessionDir}`);
      }

      // ====== Step 5: 确保必要插件已安装并启用 ======
      // 关键发现：OpenClaw 自带 34 个插件，但大多数是 disabled 状态（"4/34 loaded"）
      // 需要显式 enable 飞书插件 + 模型认证插件 + 推荐插件
      console.log('[Gateway] Step 5: 确保必要插件已安装并启用...');

      // 5a. 列出当前插件
      const pluginsList = this.exec(`${this.buildClawCmd(gatewayPath, 'plugins list')} 2>&1 || true`, sharedEnv, 'plugins list');
      const cleanPlugins = pluginsList.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim();
      this.pushLog(`[插件] 当前插件列表: ${cleanPlugins.slice(0, 800)}`);

      // 5b. 构建需要启用的插件列表（根据用户配置动态决定）
      const appConfig = this.configManager.getConfig();
      const pluginsToEnable: Array<{ id: string; reason: string }> = [
        // 飞书插件 — 必须
        { id: 'feishu', reason: '飞书通信（必须）' },
      ];

      // 根据模型 provider 自动启用对应的认证插件
      const selectedProvider = appConfig.model.provider?.toLowerCase() || '';
      const primaryModel = appConfig.model.primary?.toLowerCase() || '';

      if (selectedProvider.includes('minimax') || primaryModel.includes('minimax')) {
        pluginsToEnable.push({ id: 'minimax-portal-auth', reason: 'MiniMax OAuth 认证' });
      }
      if (selectedProvider.includes('qwen') || primaryModel.includes('qwen')) {
        pluginsToEnable.push({ id: 'qwen-portal-auth', reason: '通义千问 OAuth 认证' });
      }
      if (selectedProvider.includes('moonshot') || primaryModel.includes('moonshot')) {
        // Moonshot/Kimi 使用标准 OpenAI API，不需要特殊插件，但检查是否有 portal-auth
        // 如果后续 OpenClaw 增加了 moonshot-portal-auth 插件可以在这里启用
      }

      // 推荐插件 — 增强功能
      if (appConfig.advanced.memoryEnabled) {
        pluginsToEnable.push({ id: 'memory-lancedb', reason: '本地向量记忆（推荐）' });
      }

      this.pushLog(`[插件] 计划启用 ${pluginsToEnable.length} 个插件: ${pluginsToEnable.map(p => p.id).join(', ')}`);

      // 5c. 逐个启用插件
      for (const plugin of pluginsToEnable) {
        console.log(`[Gateway] 启用插件: ${plugin.id} (${plugin.reason})`);
        // 尝试多种命令格式
        const variants = [
          `plugins enable ${plugin.id}`,
          `plugins enable @openclaw/${plugin.id}`,
        ];
        let enabled = false;
        for (const cmd of variants) {
          const out = this.exec(`${this.buildClawCmd(gatewayPath, cmd)} 2>&1 || true`, sharedEnv, cmd);
          const cleanOut = out.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim();
          if (cleanOut && !/error|unknown|not found|invalid/i.test(cleanOut)) {
            this.pushLog(`[插件] ✓ ${plugin.id} 启用成功 (${plugin.reason})`);
            enabled = true;
            break;
          }
        }
        if (!enabled) {
          this.pushLog(`[插件] ⚠ ${plugin.id} 启用失败，可能已启用或不存在`);
        }
      }

      // 5d. 如果飞书插件不在列表中，尝试 install（可能是全新环境）
      if (!/feishu/i.test(pluginsList)) {
        this.pushLog('[插件] 插件列表中未找到 feishu，尝试安装');
        const installOut = this.exec(`${this.buildClawCmd(gatewayPath, 'plugins install @openclaw/feishu')} 2>&1 || true`, sharedEnv, 'plugins install feishu');
        this.pushLog(`[插件] 安装结果: ${installOut.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim().slice(0, 400)}`);
      }

      // 5e. 最终验证
      const pluginsVerify = this.exec(`${this.buildClawCmd(gatewayPath, 'plugins list')} 2>&1 || true`, sharedEnv, 'plugins list (final)');
      this.pushLog(`[插件] 最终插件列表: ${pluginsVerify.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim().slice(0, 800)}`);

      // ====== Step 6: 安装插件后重新运行 doctor --fix（插件安装后 doctor 应能正确启用 channel）======
      console.log('[Gateway] Step 6: 再次运行 doctor --fix（安装插件后）...');
      const doctorOut2 = this.exec(`${this.buildClawCmd(gatewayPath, 'doctor --fix')} 2>&1 || true`, sharedEnv, 'doctor --fix (post-plugin)');
      this.pushLog(`[doctor 2] 输出: ${doctorOut2.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim().slice(0, 600)}`);

      // ====== Step 7: 停掉 doctor/plugins 命令可能启动的 LaunchAgent Gateway ======
      console.log('[Gateway] Step 7: 停掉 LaunchAgent...');
      this.exec('launchctl bootout gui/$UID/ai.openclaw.gateway 2>/dev/null || true', sharedEnv, 'launchctl bootout (2)');
      this.exec('lsof -ti :18789 | xargs kill -9 2>/dev/null || true', sharedEnv, 'kill port 18789 (2)');

      await this.waitForPortRelease(18789, 8000);

      // ====== Step 8: 确保我们的配置正确（doctor/plugins 可能修改了 openclaw.json）======
      // 读取当前 openclaw.json（可能被 doctor 修改过）
      let currentNativeConfig: any = {};
      try {
        if (fs.existsSync(configPath)) {
          currentNativeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
      } catch {}

      // 确保 feishu channel 配置存在且 enabled，同时保留 doctor 可能添加的字段
      const feishuCfg = this.configManager.getConfig().feishu;
      if (currentNativeConfig.channels?.feishu) {
        // doctor 或 plugin 已创建了 feishu channel 配置 — 保留其结构，覆盖凭证
        currentNativeConfig.channels.feishu.enabled = true;
        if (feishuCfg.appId) {
          if (!currentNativeConfig.channels.feishu.accounts) {
            currentNativeConfig.channels.feishu.accounts = {};
          }
          const accounts = currentNativeConfig.channels.feishu.accounts;
          const accountKey = accounts.main ? 'main' : Object.keys(accounts)[0] || 'main';
          accounts[accountKey] = {
            ...(accounts[accountKey] || {}),
            domain: 'feishu',
            appId: feishuCfg.appId,
            appSecret: feishuCfg.appSecret,
            ...(feishuCfg.verificationToken ? { verificationToken: feishuCfg.verificationToken } : {}),
            ...(feishuCfg.encryptKey ? { encryptKey: feishuCfg.encryptKey } : {}),
            botName: feishuCfg.botName,
          };
        }
        fs.writeFileSync(configPath, JSON.stringify(currentNativeConfig, null, 2), 'utf-8');
        this.pushLog('[配置] 已合并 doctor/plugin 生成的配置 + 我们的飞书凭证，确保 enabled=true');
      } else {
        // doctor 没有创建 feishu channel — 用我们的精简配置
        this.configManager.ensureNativeConfig();
        this.pushLog('[配置] doctor 未创建 feishu channel，使用我们的精简配置');
      }

      // 打印最终配置
      try {
        const finalConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const finalChannels = finalConfig.channels ? JSON.stringify(finalConfig.channels, null, 2).slice(0, 800) : '无';
        this.pushLog(`[配置] 最终 channels: ${finalChannels}`);
      } catch {}

      // ====== Step 9: 自己 spawn gateway ======
      console.log(`[Gateway] Step 9: 启动 ${gatewayPath} gateway`);
      console.log(`[Gateway] OPENCLAW_HOME: ${os.homedir()} (config dir: ${configDir})`);

      // 如果 gatewayPath 是 .js 文件（bundled 模式），需要用 node 执行
      let spawnBin: string;
      let spawnArgs: string[];
      if (gatewayPath.endsWith('.js')) {
        const nodeBin = getBundledNodePath() || findExecutable('node') || 'node';
        spawnBin = nodeBin;
        spawnArgs = [gatewayPath, 'gateway'];
        console.log(`[Gateway] 使用内置 Node.js 执行: ${nodeBin} ${gatewayPath} gateway`);
      } else {
        spawnBin = gatewayPath;
        spawnArgs = ['gateway'];
      }

      this.process = spawn(spawnBin, spawnArgs, {
        env: sharedEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      this.startTime = Date.now();

      let recentStderr = '';
      let allOutput = '';  // 收集所有输出用于检测飞书状态

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('[Gateway stdout]', output.trim());
        allOutput += output;

        // 写入日志缓冲区
        for (const l of output.split('\n').filter((s: string) => s.trim())) {
          this.pushLog(`[stdout] ${l.trim()}`);
        }

        // 检测 Gateway 就绪
        if (output.includes('Gateway ready') || output.includes('listening') || output.includes('started')) {
          this.updateState({ status: 'running' });
        }

        // 检测飞书连接（多种模式匹配）
        this.detectFeishuFromLog(output);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const line = data.toString();
        console.error('[Gateway stderr]', line.trim());
        recentStderr += line;
        allOutput += line;
        if (recentStderr.length > 2000) recentStderr = recentStderr.slice(-2000);

        // 写入日志缓冲区
        for (const l of line.split('\n').filter((s: string) => s.trim())) {
          this.pushLog(`[stderr] ${l.trim()}`);
        }

        // stderr 中也可能有飞书状态信息
        this.detectFeishuFromLog(line);
      });

      this.process.on('exit', (code, signal) => {
        console.log(`[Gateway] 进程退出，代码: ${code}, 信号: ${signal}`);
        this.process = null;
        this.stopHealthCheck();
        if (code !== 0 && code !== null) {
          let errDetail = `Gateway 异常退出 (退出码: ${code})`;
          if (code === 127) errDetail += '\n原因: 命令未找到';
          else if (code === 1) errDetail += '\n原因: 一般性错误 — 可能是配置文件有误或端口被占用';
          if (recentStderr.trim()) errDetail += `\n\n--- 错误日志 ---\n${recentStderr.trim().slice(-800)}`;
          this.updateState({ status: 'error', error: errDetail, feishuConnected: false });
        } else {
          this.updateState({ status: 'stopped', feishuConnected: false });
        }
      });

      this.process.on('error', (err: NodeJS.ErrnoException) => {
        console.error('[Gateway] 启动失败:', err);
        this.process = null;
        let friendlyMsg = `启动失败: ${err.message}`;
        if (err.code === 'ENOENT') {
          friendlyMsg = `找不到 OpenClaw 程序。\n路径: ${gatewayPath}`;
          this.updateState({ engineStatus: 'not_installed' });
        } else if (err.code === 'EACCES') {
          friendlyMsg = `没有执行权限。\n路径: ${gatewayPath}\n\n请执行: chmod +x "${gatewayPath}"`;
        }
        this.updateState({ status: 'error', error: friendlyMsg });
      });

      // 等待启动（最多 15 秒）
      await this.waitForReady(15000);

      // 启动健康检查（同时检测飞书连接）
      this.startHealthCheck();
    } catch (err: any) {
      this.updateState({ status: 'error', error: err.message || '未知错误' });
      throw err;
    }
  }

  /**
   * 从日志输出中检测飞书连接状态
   * 优先级：活跃信号 > 权限警告 > 致命错误
   */
  private detectFeishuFromLog(output: string): void {
    const lower = output.toLowerCase();

    // ========= 1. 活跃信号（最强正面证据：channel 在收发消息）=========
    if (
      lower.includes('feishu') && (
        lower.includes('received message') ||
        lower.includes('dispatching to agent') ||
        lower.includes('dispatch complete') ||
        lower.includes('deliver') ||
        lower.includes('ws connected') ||
        lower.includes('channel feishu started') ||
        lower.includes('feishu channel is active')
      )
    ) {
      if (!this.state.feishuConnected) {
        console.log(`[Gateway] 飞书 channel 活跃`);
        this.pushLog(`[飞书] ✅ 连接成功 — ${output.trim().slice(0, 100)}`);
      }
      // 保留之前的权限警告 detail（如果有的话）
      const prevDetail = this.state.feishuDetail || '';
      const keepWarning = prevDetail.includes('⚠️') ? prevDetail : '';
      this.updateState({
        feishuConnected: true,
        feishuDetail: keepWarning || `飞书已连接并工作中`,
      });
      return; // 活跃信号优先，跳过后续检查
    }

    // ========= 2. 权限警告（非致命 — channel 仍在工作）=========
    if (lower.includes('feishu') && lower.includes('permission error')) {
      // 提取缺少的权限名称
      const permMatch = output.match(/required:\s*\[([^\]]+)\]/i);
      const perms = permMatch ? permMatch[1].split(',').map(s => s.trim()).join('\n  · ') : '未知权限';
      const warningDetail = [
        '飞书已连接 ⚠️ 部分功能受限',
        '',
        '缺少以下权限（不影响基本收发消息）:',
        `  · ${perms}`,
        '',
        '请在飞书开放平台 → 权限管理 中添加上述权限，',
        '然后重新发布应用版本。',
      ].join('\n');
      this.pushLog(`[飞书] ⚠️ 权限不足 — ${perms.slice(0, 100)}`);
      // 权限错误不改变连接状态 — 如果已连接则保持连接
      this.updateState({ feishuDetail: warningDetail });
      if (!this.state.feishuConnected) {
        // 如果还没检测到活跃信号，先乐观地标记为已连接
        this.updateState({ feishuConnected: true });
      }
      return;
    }

    // ========= 3. 一般性正面信号 =========
    if (
      (lower.includes('feishu') && (lower.includes('connected') || lower.includes('ready') || lower.includes('online')))
    ) {
      if (!this.state.feishuConnected) {
        this.pushLog(`[飞书] ✅ 连接成功 — ${output.trim().slice(0, 100)}`);
        this.updateState({ feishuConnected: true, feishuDetail: `飞书已连接` });
      }
      return;
    }

    // ========= 4. 致命错误（channel 无法工作）=========
    if (
      lower.includes('feishu') && (
        lower.includes('not enabled') ||
        lower.includes('disconnected') ||
        lower.includes('failed to start') ||
        lower.includes('channel stopped') ||
        lower.includes('plugin not found')
      )
    ) {
      const detail = `飞书异常: "${output.trim().slice(0, 200)}"`;
      console.log(`[Gateway] ${detail}`);
      this.pushLog(`[飞书] ❌ 致命错误 — ${output.trim().slice(0, 100)}`);
      this.updateState({ feishuConnected: false, feishuDetail: detail });
      return;
    }

    // ========= 5. 非致命错误（typing indicator 失败等）— 不改变状态 =========
    if (lower.includes('feishu') && (lower.includes('error') || lower.includes('failed'))) {
      this.pushLog(`[飞书] ⚠️ 非致命错误 — ${output.trim().slice(0, 100)}`);
      // 不改变 feishuConnected 状态
    }

    // 记录所有包含 feishu 关键字的日志
    if (lower.includes('feishu') || (lower.includes('channel') && !lower.includes('channels'))) {
      this.pushLog(`[飞书相关] ${output.trim().slice(0, 200)}`);
    }
  }

  /**
   * 等待端口释放
   */
  private async waitForPortRelease(port: number, timeout: number): Promise<void> {
    const interval = 500;
    let waited = 0;

    while (waited < timeout) {
      try {
        const result = execSync(`lsof -ti :${port} 2>/dev/null || true`, {
          encoding: 'utf-8',
          timeout: 3000,
          shell: '/bin/bash',
        }).trim();

        if (!result) {
          console.log(`[Gateway] 端口 ${port} 已释放 (${waited}ms)`);
          return;
        }
        console.log(`[Gateway] 端口 ${port} 仍被占用 (pid: ${result})，等待...`);
      } catch {
        return;
      }

      await new Promise((r) => setTimeout(r, interval));
      waited += interval;
    }
    console.log(`[Gateway] 端口 ${port} 等待超时`);
  }

  /**
   * 停止 Gateway
   */
  async stop(): Promise<void> {
    this.stopHealthCheck();

    // 1. 停止自己 spawn 的进程
    if (this.process) {
      await new Promise<void>((resolve) => {
        if (!this.process) { resolve(); return; }
        const timer = setTimeout(() => {
          if (this.process) this.process.kill('SIGKILL');
        }, 5000);
        this.process.once('exit', () => {
          clearTimeout(timer);
          this.process = null;
          resolve();
        });
        this.process.kill('SIGTERM');
      });
    }

    // 2. 同时也停止外部 Gateway
    const gatewayPath = this.getGatewayPath();
    if (gatewayPath) {
      const env = this.buildSharedEnv(gatewayPath);
      this.exec(`${this.buildClawCmd(gatewayPath, 'gateway stop')} 2>&1 || true`, env, 'stop: gateway stop');
      this.exec('launchctl bootout gui/$UID/ai.openclaw.gateway 2>/dev/null || true', env, 'stop: launchctl');
    }

    this.updateState({ status: 'stopped', feishuConnected: false });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getState(): GatewayState {
    return {
      ...this.state,
      pid: this.process?.pid,
      uptime: this.state.status === 'running' ? Date.now() - this.startTime : undefined,
      recentLogs: this.logBuffer.slice(-30),
    };
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  /**
   * 等待 Gateway 就绪
   */
  private waitForReady(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.updateState({ status: 'running' });
          resolve();
        } else {
          reject(new Error('Gateway 启动超时'));
        }
      }, timeout);

      const unsub = this.onStatusChange(() => {
        if (this.state.status === 'running') {
          clearTimeout(timer);
          unsub();
          resolve();
        } else if (this.state.status === 'error') {
          clearTimeout(timer);
          unsub();
          reject(new Error(this.state.error || 'Gateway 启动失败'));
        }
      });
    });
  }

  /**
   * 定时健康检查 — 同时通过 HTTP 探测 Gateway 状态和飞书连接状态
   */
  private startHealthCheck(): void {
    // 首次启动后 3 秒做一次检查
    setTimeout(() => this.doHealthCheck(), 3000);

    // 之后每 10 秒检查一次
    this.healthCheckInterval = setInterval(() => this.doHealthCheck(), 10000);
  }

  private async doHealthCheck(): Promise<void> {
    const healthDetails: string[] = [];
    let gatewayAlive = false;
    let feishuDetected = false;

    // ====== 方法1: 端口探测（检查 Gateway 是否存活）======
    try {
      const body = await this.httpGet('/health', 18789);
      if (body !== null) {
        gatewayAlive = true;
        healthDetails.push('Gateway 端口 18789 → 响应正常');
      } else {
        healthDetails.push('Gateway 端口 18789 → 无响应');
      }
    } catch {
      healthDetails.push('Gateway 端口 18789 → 连接失败');
    }

    // ====== 方法2: 读取 Gateway 日志文件（最可靠的飞书状态来源）======
    try {
      const logResult = this.readGatewayLogFile();
      healthDetails.push(`日志文件: ${logResult.logPath}`);

      if (logResult.lines.length > 0) {
        healthDetails.push(`日志行数: ${logResult.totalLines}，分析最后 ${logResult.lines.length} 行`);

        // 把最后几行写入我们的日志缓冲
        const newLines = logResult.lines.slice(-5);
        for (const l of newLines) {
          if (!this.logBuffer.some(existing => existing.includes(l.slice(0, 60)))) {
            this.pushLog(`[Gateway日志] ${l}`);
          }
        }

        // 搜索飞书相关日志
        const feishuLines = logResult.lines.filter(
          l => /feishu|lark|飞书|channel/i.test(l)
        );
        if (feishuLines.length > 0) {
          healthDetails.push(`飞书相关日志 (${feishuLines.length} 行):`);
          // 取最后几行飞书日志
          for (const fl of feishuLines.slice(-5)) {
            healthDetails.push(`  ${fl.slice(0, 200)}`);
          }

          // 分析全部飞书日志来判断状态（不只看最后一条）
          const allFeishuText = feishuLines.join(' ').toLowerCase();

          // 活跃信号：收到消息/分发消息/回复消息
          const hasActiveSignal =
            allFeishuText.includes('received message') ||
            allFeishuText.includes('dispatching to agent') ||
            allFeishuText.includes('dispatch complete') ||
            allFeishuText.includes('deliver');

          // 连接信号
          const hasConnectedSignal =
            allFeishuText.includes('connected') ||
            allFeishuText.includes('ready') ||
            allFeishuText.includes('active') ||
            allFeishuText.includes('online') ||
            allFeishuText.includes('started');

          // 权限警告（非致命）
          const hasPermissionWarning = allFeishuText.includes('permission error');

          // 致命错误
          const hasFatalError =
            allFeishuText.includes('not enabled') ||
            allFeishuText.includes('disconnected') ||
            allFeishuText.includes('failed to start') ||
            allFeishuText.includes('channel stopped');

          if (hasActiveSignal || hasConnectedSignal) {
            feishuDetected = true;
            if (hasPermissionWarning) {
              // 连接正常但有权限警告
              const permMatch = feishuLines.join('\n').match(/required:\s*\[([^\]]+)\]/i);
              const perms = permMatch ? permMatch[1].split(',').map((s: string) => s.trim()).join(', ') : '';
              const detail = `飞书已连接 ⚠️ 部分权限缺失: ${perms}\n请在飞书开放平台 → 权限管理 中添加`;
              this.updateState({ feishuConnected: true, feishuDetail: detail });
              healthDetails.push('→ 飞书状态: ✅ 已连接（有权限警告）');
            } else {
              this.updateState({ feishuConnected: true, feishuDetail: '飞书已连接并工作中' });
              healthDetails.push('→ 飞书状态: ✅ 已连接');
            }
          } else if (hasFatalError) {
            feishuDetected = true;
            const lastLine = feishuLines[feishuLines.length - 1].slice(0, 200);
            this.updateState({ feishuConnected: false, feishuDetail: `飞书异常: ${lastLine}` });
            healthDetails.push('→ 飞书状态: ❌ 异常');
          } else if (hasPermissionWarning) {
            // 只有权限错误，说明 channel 在工作
            feishuDetected = true;
            this.updateState({ feishuConnected: true, feishuDetail: '飞书已连接 ⚠️ 部分权限缺失' });
            healthDetails.push('→ 飞书状态: ✅ 已连接（有权限警告）');
          } else {
            healthDetails.push('→ 飞书日志存在，但无法确定连接状态');
          }
        } else {
          healthDetails.push('日志中未找到飞书/feishu 相关记录');
        }

        // 也搜索错误信息
        const errorLines = logResult.lines.filter(
          l => /error|fatal|panic|exception/i.test(l)
        );
        if (errorLines.length > 0) {
          healthDetails.push(`错误日志 (${errorLines.length} 行):`);
          for (const el of errorLines.slice(-3)) {
            healthDetails.push(`  ⚠ ${el.slice(0, 200)}`);
          }
        }
      } else {
        healthDetails.push('日志文件为空或不存在');
      }
    } catch (e: any) {
      healthDetails.push(`日志文件读取失败: ${e?.message || e}`);
    }

    // ====== 方法3: 直接调用飞书 API 验证凭证可达性 ======
    if (!feishuDetected) {
      try {
        const feishuAlive = await this.checkFeishuApiDirect();
        healthDetails.push(`飞书 API 直连: ${feishuAlive.detail}`);
        if (feishuAlive.tokenOk) {
          healthDetails.push('飞书凭证有效，但 Gateway 日志未报告 channel 已连接');
          this.updateState({
            feishuDetail: [
              `飞书凭证有效 (${feishuAlive.detail})`,
              `但 Gateway 日志中未发现飞书 channel 连接成功的记录。`,
              `可能原因：`,
              `· 飞书开放平台 → 事件与回调 → 未选择"长连接"模式`,
              `· 飞书开放平台 → 事件与回调 → 未添加 im.message.receive_v1 事件`,
              `· openclaw.json 中 channels.feishu 配置有误`,
              `· Gateway 版本不支持飞书长连接`,
            ].join('\n'),
          });
        } else {
          this.updateState({
            feishuDetail: `飞书凭证验证失败: ${feishuAlive.detail}`,
          });
        }
      } catch {
        healthDetails.push('飞书 API 直连检测失败');
      }
    }

    // ====== 更新 Gateway 存活状态 ======
    if (gatewayAlive) {
      if (this.state.status !== 'running') {
        this.updateState({ status: 'running' });
      }
    } else if (this.process && !this.process.killed) {
      // 进程还在但端口不通，可能还在启动
      healthDetails.push('进程存在但端口未响应（可能启动中）');
    } else if (this.state.status === 'running') {
      this.updateState({
        status: 'error',
        error: '健康检查失败 — Gateway 可能已退出',
        feishuConnected: false,
      });
    }

    // ====== 更新健康检查详情 ======
    this.updateState({ healthCheckDetail: healthDetails.join('\n') });
  }

  /**
   * 读取 Gateway 日志文件 /tmp/openclaw/openclaw-YYYY-MM-DD.log
   */
  private readGatewayLogFile(): { logPath: string; lines: string[]; totalLines: number } {
    // 使用本地日期（Gateway 用本地日期命名日志文件，不是 UTC）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const logDir = '/tmp/openclaw';
    const logPath = path.join(logDir, `openclaw-${today}.log`);

    // 也检查 ~/.openclaw/logs/ 备选路径
    const altLogDir = path.join(this.configManager.getConfigDir(), 'logs');
    const altLogPath = path.join(altLogDir, `openclaw-${today}.log`);

    let targetPath = logPath;
    if (!fs.existsSync(logPath) && fs.existsSync(altLogPath)) {
      targetPath = altLogPath;
    }

    if (!fs.existsSync(targetPath)) {
      // 尝试找到任何 openclaw 日志
      try {
        if (fs.existsSync(logDir)) {
          const files = fs.readdirSync(logDir)
            .filter(f => f.startsWith('openclaw-') && f.endsWith('.log'))
            .sort()
            .reverse();
          if (files.length > 0) {
            targetPath = path.join(logDir, files[0]);
          }
        }
      } catch { /* ignore */ }
    }

    if (!fs.existsSync(targetPath)) {
      return { logPath: `${logPath} (不存在)`, lines: [], totalLines: 0 };
    }

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const allLines = content.split('\n').filter(l => l.trim());
      // 只取最后 100 行分析
      const lines = allLines.slice(-100);
      return { logPath: targetPath, lines, totalLines: allLines.length };
    } catch (e: any) {
      return { logPath: `${targetPath} (读取失败: ${e.message})`, lines: [], totalLines: 0 };
    }
  }

  /**
   * 直接调用飞书 API 验证凭证是否有效（不依赖 Gateway）
   */
  private checkFeishuApiDirect(): Promise<{ tokenOk: boolean; botOk: boolean; detail: string }> {
    return new Promise((resolve) => {
      const config = this.configManager.getConfig();
      const { appId, appSecret } = config.feishu;

      if (!appId || !appSecret) {
        resolve({ tokenOk: false, botOk: false, detail: '飞书 App ID 或 Secret 未配置' });
        return;
      }

      // 获取 tenant_access_token
      const https = require('https');
      const postData = JSON.stringify({ app_id: appId, app_secret: appSecret });

      const req = https.request(
        {
          hostname: 'open.feishu.cn',
          path: '/open-apis/auth/v3/tenant_access_token/internal',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 8000,
        },
        (res: any) => {
          let body = '';
          res.on('data', (chunk: string) => (body += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (json.code === 0 && json.tenant_access_token) {
                // Token 获取成功，进一步检查 bot info
                const botReq = https.request(
                  {
                    hostname: 'open.feishu.cn',
                    path: '/open-apis/bot/v3/info/',
                    method: 'GET',
                    headers: {
                      Authorization: `Bearer ${json.tenant_access_token}`,
                      'Content-Type': 'application/json',
                    },
                    timeout: 8000,
                  },
                  (botRes: any) => {
                    let botBody = '';
                    botRes.on('data', (chunk: string) => (botBody += chunk));
                    botRes.on('end', () => {
                      try {
                        const botJson = JSON.parse(botBody);
                        if (botJson.code === 0 && botJson.bot) {
                          resolve({
                            tokenOk: true,
                            botOk: true,
                            detail: `凭证有效 ✓ | 机器人: ${botJson.bot.app_name || '未知'} | activate_status=${botJson.bot.activate_status}`,
                          });
                        } else {
                          resolve({
                            tokenOk: true,
                            botOk: false,
                            detail: `凭证有效 ✓ | 但机器人查询失败: code=${botJson.code} msg=${botJson.msg}`,
                          });
                        }
                      } catch {
                        resolve({ tokenOk: true, botOk: false, detail: '凭证有效 ✓ | 机器人响应解析失败' });
                      }
                    });
                  }
                );
                botReq.on('error', () => resolve({ tokenOk: true, botOk: false, detail: '凭证有效 ✓ | 机器人查询网络错误' }));
                botReq.on('timeout', () => { botReq.destroy(); resolve({ tokenOk: true, botOk: false, detail: '凭证有效 ✓ | 机器人查询超时' }); });
                botReq.end();
              } else {
                resolve({
                  tokenOk: false,
                  botOk: false,
                  detail: `凭证无效 ✗ | code=${json.code} msg=${json.msg}`,
                });
              }
            } catch {
              resolve({ tokenOk: false, botOk: false, detail: '飞书 API 响应解析失败' });
            }
          });
        }
      );
      req.on('error', (err: any) => resolve({ tokenOk: false, botOk: false, detail: `网络错误: ${err.message}` }));
      req.on('timeout', () => { req.destroy(); resolve({ tokenOk: false, botOk: false, detail: '请求超时' }); });
      req.write(postData);
      req.end();
    });
  }

  /**
   * HTTP GET 请求辅助方法
   */
  private httpGet(urlPath: string, port: number): Promise<string | null> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: urlPath,
          method: 'GET',
          timeout: 3000,
          headers: {
            // 带上 auth token 以防需要认证
            'Authorization': `Bearer ${this.configManager.getGatewayToken()}`,
            // 关键：请求 JSON 格式，避免 SPA 返回 HTML
            'Accept': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              this.pushLog(`[HTTP] ${urlPath} → ${res.statusCode}`);
              resolve(null);
            }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval as any);
      this.healthCheckInterval = null;
    }
  }

  // ==================== 插件管理 ====================

  /**
   * 列出所有插件及其状态
   */
  listPlugins(): Array<{ name: string; id: string; status: string; description: string }> {
    const gatewayPath = this.getGatewayPath();
    if (!gatewayPath) return [];

    const env = this.buildSharedEnv(gatewayPath);
    const output = this.exec(`${this.buildClawCmd(gatewayPath, 'plugins list')} 2>&1 || true`, env, 'plugins list (UI)');
    return this.parsePluginList(output);
  }

  /**
   * 启用或禁用插件
   */
  togglePlugin(pluginId: string, enable: boolean): { success: boolean; message: string } {
    const gatewayPath = this.getGatewayPath();
    if (!gatewayPath) return { success: false, message: 'OpenClaw 引擎未安装' };

    const env = this.buildSharedEnv(gatewayPath);
    const cmd = enable ? 'enable' : 'disable';
    const output = this.exec(
      `${this.buildClawCmd(gatewayPath, `plugins ${cmd} ${pluginId}`)} 2>&1 || true`,
      env,
      `plugins ${cmd} ${pluginId}`
    );
    const clean = output.replace(/[░▀▄█▌▐─│╮╯╰╭◇├┤┼]/g, '').trim();
    const success = !/error|unknown command|not found/i.test(clean);
    this.pushLog(`[插件] ${cmd} ${pluginId} → ${success ? '成功' : '失败'}: ${clean.slice(0, 200)}`);
    return { success, message: clean.slice(0, 500) };
  }

  /**
   * 解析 plugins list 的表格输出
   *
   * 关键问题：表格 ID 列宽度有限，长 ID 会被截断（如 bluebubbles → bluebubb）。
   * 解决方案：从 Source 列的路径中提取真实 ID（extensions/xxx/index.ts → xxx）。
   *
   * 表格跨行：一个插件可能占多行（Name/ID/Source 都会换行），
   * 需要把连续行合并为一个插件的信息。
   */
  private parsePluginList(output: string): Array<{ name: string; id: string; status: string; description: string }> {
    const plugins: Array<{ name: string; id: string; status: string; description: string }> = [];
    const seen = new Set<string>();

    // 清理 ANSI 颜色码
    const cleaned = output.replace(/\x1B\[[0-9;]*m/g, '');

    // 把整个输出当作一个连续文本，用正则找到每个 "extensions/xxx/" 路径
    // 这是获取真实插件 ID 最可靠的方式
    const extensionMatches = cleaned.matchAll(/extensions\/([a-z0-9_-]+)\//gi);
    const extensionIds = new Set<string>();
    for (const m of extensionMatches) {
      extensionIds.add(m[1]);
    }

    // 用表格行解析来获取 Name 和 Status，并用 Source 路径校正 ID
    // 把表格边框统一替换为 |
    const lines = cleaned.split('\n');

    // 收集数据：合并跨行的表格单元格
    // 找到所有包含 loaded/disabled/error 的行（状态行），这是插件主行
    let currentPlugin: { name: string; id: string; status: string; source: string; description: string } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.replace(/[│┌┐└┘├┤┬┴┼─═╮╯╰╭]/g, '|').trim();

      // 跳过空行和纯分隔符行
      if (!line || /^[|\-=\s]+$/.test(line)) continue;

      // 跳过标题行
      if (/^\|?\s*(Name|Plugin)\s*\|/i.test(line)) continue;

      const parts = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
      if (parts.length < 2) continue;

      // 检查是否是包含状态关键字的主行
      const hasStatus = parts.some(p => /^(loaded|disabled|error)$/i.test(p));

      if (hasStatus) {
        // 保存前一个插件（如果有）
        if (currentPlugin && currentPlugin.id) {
          this.finalizePlugin(currentPlugin, plugins, seen, extensionIds);
        }

        // 开始新插件
        const statusIdx = parts.findIndex(p => /^(loaded|disabled|error)$/i.test(p));
        currentPlugin = {
          name: statusIdx >= 1 ? parts[0] : '',
          id: statusIdx >= 2 ? parts[statusIdx - 1] : (statusIdx >= 1 ? parts[0] : ''),
          status: parts[statusIdx].toLowerCase(),
          source: parts.slice(statusIdx + 1).join(' ').trim(),
          description: '',
        };
      } else if (currentPlugin) {
        // 续行 — 把内容追加到当前插件
        const joinedLine = parts.join(' ');
        // 检查是否有 extensions/ 路径（Source 的续行）
        if (/extensions\//.test(joinedLine)) {
          currentPlugin.source += ' ' + joinedLine;
        } else if (/openclaw|plugin|channel|tool|memory|voice|workflow|oauth|generate|manage|generic/i.test(joinedLine)) {
          // 可能是描述行
          if (!currentPlugin.description) {
            currentPlugin.description = joinedLine;
          }
        } else {
          // 可能是 Name 或 ID 的续行
          // 如果上一行的 name 看起来不完整（如 @openclaw/），尝试拼接
          if (currentPlugin.name.endsWith('-') || currentPlugin.name.endsWith('/')) {
            currentPlugin.name += parts[0];
          }
          if (currentPlugin.id.endsWith('-') || currentPlugin.id.endsWith('/')) {
            currentPlugin.id += parts[0];
          }
        }
      }
    }

    // 保存最后一个插件
    if (currentPlugin && currentPlugin.id) {
      this.finalizePlugin(currentPlugin, plugins, seen, extensionIds);
    }

    console.log(`[Plugins] 解析到 ${plugins.length} 个插件 (extensions 目录中发现 ${extensionIds.size} 个)`);

    // 如果表格解析结果太少，直接用 extensions 目录列表补充
    if (plugins.length < 5 && extensionIds.size > 0) {
      // 从 extensions 目录推断，用原始输出判断状态
      for (const extId of extensionIds) {
        if (seen.has(extId)) continue;
        // 检查原始输出中这个 extension 附近是否有 loaded/disabled
        const regex = new RegExp(`extensions/${extId}/[^│|]*(?:│|\\|)[^│|]*(loaded|disabled|error)`, 'i');
        const statusMatch = cleaned.match(regex);
        seen.add(extId);
        plugins.push({
          name: extId,
          id: extId,
          status: statusMatch ? statusMatch[1].toLowerCase() : 'disabled',
          description: '',
        });
      }
    }

    return plugins;
  }

  /**
   * 用 Source 路径校正被截断的 ID，然后保存插件
   */
  private finalizePlugin(
    plugin: { name: string; id: string; status: string; source: string; description: string },
    plugins: Array<{ name: string; id: string; status: string; description: string }>,
    seen: Set<string>,
    extensionIds: Set<string>,
  ): void {
    // 从 Source 路径中提取真实 ID（最可靠）
    const sourceMatch = plugin.source.match(/extensions\/([a-z0-9_-]+)\//i);
    let realId = sourceMatch ? sourceMatch[1] : plugin.id;

    // 如果 Source 没匹配到，尝试用截断的 ID 匹配 extensions 集合
    if (!sourceMatch && plugin.id) {
      for (const extId of extensionIds) {
        if (extId.startsWith(plugin.id) || plugin.id.startsWith(extId)) {
          realId = extId;
          break;
        }
      }
    }

    // 清理 name（去除 @openclaw/ 前缀）
    const cleanName = plugin.name.replace(/^@openclaw\/\s*/, '').trim() || realId;

    if (realId && !seen.has(realId)) {
      seen.add(realId);
      plugins.push({
        name: cleanName,
        id: realId,
        status: plugin.status,
        description: plugin.description,
      });
    }
  }

  private updateState(partial: Partial<GatewayState>): void {
    this.state = { ...this.state, ...partial };
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try { listener(currentState); } catch { /* ignore */ }
    }
  }
}
