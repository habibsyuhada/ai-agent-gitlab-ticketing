import path from 'path';
import fs from 'fs/promises';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

export class Logger {
  private runId: string;
  private logs: LogEntry[] = [];
  private logsDir: string;

  constructor(runId: string) {
    this.runId = runId;
    this.logsDir = path.join(process.cwd(), 'automation-logs', 'runs');
  }

  private addLog(level: LogEntry['level'], message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    this.logs.push(entry);
  }

  info(message: string, data?: unknown): void {
    console.log(`[INFO] ${message}`, data || '');
    this.addLog('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    console.warn(`[WARN] ${message}`, data || '');
    this.addLog('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    console.error(`[ERROR] ${message}`, data || '');
    this.addLog('error', message, data);
  }

  debug(message: string, data?: unknown): void {
    if (process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${message}`, data || '');
      this.addLog('debug', message, data);
    }
  }

  async save(): Promise<string> {
    await fs.mkdir(this.logsDir, { recursive: true });
    const logPath = path.join(this.logsDir, `${this.runId}.json`);
    await fs.writeFile(logPath, JSON.stringify({
      runId: this.runId,
      logs: this.logs,
      createdAt: new Date().toISOString(),
    }, null, 2));
    return logPath;
  }
}

export function createLogger(runId: string): Logger {
  return new Logger(runId);
}
