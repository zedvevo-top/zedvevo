import { type PushLogEntry, type AndroidSessionMetrics } from '@/types/index';

class PushDiagnosticStore {
  private logs: PushLogEntry[] = [];
  private metrics: AndroidSessionMetrics = {
    swStatus: 'unknown',
    deviceInfo: 'unknown',
    totalEvents: 0,
    successCount: 0,
    failCount: 0,
    sessionId: Math.random().toString(36).slice(2, 9),
  };
  private subscribers: (() => void)[] = [];

  getLogs() {
    return [...this.logs];
  }

  getMetrics() {
    return { ...this.metrics };
  }

  addLog(type: PushLogEntry['type'], source: string, message: string, details?: any) {
    const entry: PushLogEntry = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString(),
      type,
      source,
      message,
      details,
    };
    this.logs = [entry, ...this.logs].slice(0, 100);
    this.subscribers.forEach((s) => s());
  }

  clearLogs() {
    this.logs = [];
    this.subscribers.forEach((s) => s());
  }

  subscribe(callback: () => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  async runFullPushDiagnostics(route: string): Promise<any> {
    this.addLog('realtime_event', 'DiagnosticSuite', `Starting full diagnostic suite for route: ${route}`);
    // Simulated diagnostic check
    return {
      swActive: true,
      fcmCompatible: true,
      navigateProtocolSuccess: true,
      blankScreenSafe: true,
    };
  }
}

export const pushDiagnosticStore = new PushDiagnosticStore();
