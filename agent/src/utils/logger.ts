type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class Logger {
  private minLevel: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatTime(): string {
    return new Date().toISOString().split('T')[1].split('.')[0];
  }

  private log(level: LogLevel, color: string, ...args: unknown[]) {
    if (!this.shouldLog(level)) return;

    const time = `${COLORS.dim}${this.formatTime()}${COLORS.reset}`;
    const levelStr = `${color}${level.toUpperCase().padEnd(5)}${COLORS.reset}`;

    console.log(`${time} ${levelStr}`, ...args);
  }

  debug(...args: unknown[]) {
    this.log('debug', COLORS.magenta, ...args);
  }

  info(...args: unknown[]) {
    this.log('info', COLORS.green, ...args);
  }

  warn(...args: unknown[]) {
    this.log('warn', COLORS.yellow, ...args);
  }

  error(...args: unknown[]) {
    this.log('error', COLORS.red, ...args);
  }

  task(taskId: string, message: string) {
    this.info(`${COLORS.cyan}[${taskId}]${COLORS.reset} ${message}`);
  }

  payment(action: string, amount: string, txHash?: string) {
    const tx = txHash ? ` (${txHash.slice(0, 10)}...)` : '';
    this.info(`${COLORS.green}💰 ${action}: ${amount} USDC${tx}${COLORS.reset}`);
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);
