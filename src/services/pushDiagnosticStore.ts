export interface PushLogEntry {
  id: string;
  timestamp: string;
  type: 'sw_event' | 'realtime_event' | 'permission' | 'error' | 'deliver_success' | 'deliver_fail';
  source: string;
  message: string;
  details?: any;
}

export interface AndroidSessionMetrics {
  sessionId: string;
  deviceInfo: string;
  swStatus: 'active' | 'registering' | 'failed' | 'unsupported';
  totalEvents: number;
  successCount: number;
  failCount: number;
  lastActive: string;
}

class PushDiagnosticStore {
  private logs: PushLogEntry[] = [];
  private listeners: Set<() => void> = new Set();
  private metrics: AndroidSessionMetrics = {
    sessionId: `android-session-${Math.random().toString(36).substring(2, 9)}`,
    deviceInfo: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Android') ? 'Android Device' : navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser') : 'Unknown',
    swStatus: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'active' : 'unsupported',
    totalEvents: 0,
    successCount: 0,
    failCount: 0,
    lastActive: new Date().toISOString(),
  };

  constructor() {
    this.addLog('sw_event', 'DiagnosticInit', 'Push Diagnostic Engine initialized', {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    });
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public addLog(
    type: PushLogEntry['type'],
    source: string,
    message: string,
    details?: any
  ) {
    const entry: PushLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      source,
      message,
      details,
    };

    this.logs = [entry, ...this.logs.slice(0, 99)]; // keep max 100 recent logs
    this.metrics.lastActive = new Date().toISOString();
    this.metrics.totalEvents += 1;

    if (type === 'deliver_success' || type === 'realtime_event') {
      this.metrics.successCount += 1;
    } else if (type === 'error' || type === 'deliver_fail') {
      this.metrics.failCount += 1;
    }

    this.notify();
  }

  public setSWStatus(status: AndroidSessionMetrics['swStatus']) {
    this.metrics.swStatus = status;
    this.notify();
  }

  public getLogs() {
    return this.logs;
  }

  public getMetrics(): AndroidSessionMetrics {
    return { ...this.metrics };
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }
}

export const pushDiagnosticStore = new PushDiagnosticStore();
