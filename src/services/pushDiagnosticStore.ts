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

export interface DiagnosticTestSuiteResult {
  swActive: boolean;
  fcmCompatible: boolean;
  navigateProtocolSuccess: boolean;
  blankScreenSafe: boolean;
  logs: string[];
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

  // Unified Diagnostic Protocol Runner
  public async runFullPushDiagnostics(targetRoute = '/admin/notifications'): Promise<DiagnosticTestSuiteResult> {
    const result: DiagnosticTestSuiteResult = {
      swActive: false,
      fcmCompatible: false,
      navigateProtocolSuccess: false,
      blankScreenSafe: false,
      logs: [],
    };

    // 1. Check Service Worker & FCM Compatibility
    this.addLog('sw_event', 'DiagnosticSuite', 'Starting Unified Service Worker & FCM Protocol Diagnostic Test');
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.active) {
          result.swActive = true;
          this.setSWStatus('active');
          this.addLog('deliver_success', 'ServiceWorkerCheck', `Active SW found: scope ${reg.scope}`);
          
          // FCM compatibility check
          if ('PushManager' in window && 'Notification' in window) {
            result.fcmCompatible = true;
            this.addLog('deliver_success', 'FCMCheck', 'PushManager and Notification API natively supported for Android FCM');
          } else {
            this.addLog('error', 'FCMCheck', 'PushManager or Notification API missing on this mobile browser context');
          }
        } else {
          this.addLog('sw_event', 'ServiceWorkerCheck', 'No active SW found, attempting registration...');
          const newReg = await navigator.serviceWorker.register('/sw.js');
          if (newReg) {
            result.swActive = true;
            this.setSWStatus('active');
            this.addLog('deliver_success', 'ServiceWorkerCheck', 'Registered sw.js successfully');
          }
        }
      } catch (err: any) {
        this.setSWStatus('failed');
        this.addLog('error', 'ServiceWorkerCheck', `Service worker check failed: ${err?.message || err}`);
      }
    } else {
      this.setSWStatus('unsupported');
      this.addLog('error', 'ServiceWorkerCheck', 'serviceWorker API not supported in current environment');
    }

    // 2. Test NOTIFICATION_NAVIGATE Protocol Transmission
    try {
      this.addLog('sw_event', 'ProtocolCheck', `Testing NOTIFICATION_NAVIGATE protocol to route: ${targetRoute}`);
      
      // Dispatch test message event
      window.postMessage({
        type: 'NOTIFICATION_NAVIGATE',
        url: targetRoute,
        diagnosticMode: true,
        timestamp: Date.now(),
      }, '*');

      result.navigateProtocolSuccess = true;
      this.addLog('deliver_success', 'ProtocolCheck', `NOTIFICATION_NAVIGATE message dispatched successfully for route ${targetRoute}`);
    } catch (err: any) {
      this.addLog('error', 'ProtocolCheck', `Failed dispatching NOTIFICATION_NAVIGATE message: ${err?.message || err}`);
    }

    // 3. Test Blank Screen Route Safety
    try {
      this.addLog('sw_event', 'BlankScreenCheck', `Validating deep link route safety for: ${targetRoute}`);
      
      // Ensure path is valid string and origin URL can be resolved
      const resolvedUrl = new URL(targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute, window.location.origin).href;
      
      if (resolvedUrl && !resolvedUrl.includes('undefined') && !resolvedUrl.includes('null')) {
        result.blankScreenSafe = true;
        this.addLog('deliver_success', 'BlankScreenCheck', `Route ${targetRoute} resolved to safe URL: ${resolvedUrl}`);
      } else {
        this.addLog('error', 'BlankScreenCheck', `Route resolution produced invalid URL string: ${resolvedUrl}`);
      }
    } catch (err: any) {
      this.addLog('error', 'BlankScreenCheck', `Blank screen route safety check failed: ${err?.message || err}`);
    }

    return result;
  }
}

export const pushDiagnosticStore = new PushDiagnosticStore();
