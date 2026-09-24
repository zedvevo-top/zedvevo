export interface AnalyticsEvent {
  id: string;
  type: 'pageview' | 'player' | 'action';
  action: string; // e.g., 'navigate', 'play', 'pause', 'vote', 'download'
  label: string;  // e.g., '/music', 'Song Title - Artist Name'
  timestamp: string;
  metadata?: Record<string, any>;
}

const MAX_LOGS = 200;

function getLogs(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('zed_analytics_logs');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLogs(logs: AnalyticsEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('zed_analytics_logs', JSON.stringify(logs.slice(0, MAX_LOGS)));
    // Dispatch a custom event to notify listeners (like the admin dashboard) instantly
    window.dispatchEvent(new Event('zed_analytics_updated'));
  } catch (e) {
    // Ignore
  }
}

export const analytics = {
  logEvent(type: 'pageview' | 'player' | 'action', action: string, label: string, metadata?: Record<string, any>) {
    const event: AnalyticsEvent = {
      id: Math.random().toString(36).slice(2, 11),
      type,
      action,
      label,
      timestamp: new Date().toISOString(),
      metadata,
    };
    const logs = [event, ...getLogs()];
    saveLogs(logs);
  },

  trackPageview(path: string, search = '') {
    this.logEvent('pageview', 'navigate', path + search, { path, search });
  },

  trackPlayerEvent(action: 'play' | 'pause' | 'skip' | 'prev' | 'volume' | 'completed' | 'seek', songTitle: string, artistName: string, extra?: Record<string, any>) {
    this.logEvent('player', action, `${songTitle} - ${artistName}`, {
      song: songTitle,
      artist: artistName,
      ...extra
    });
  },

  trackAction(action: string, label: string, extra?: Record<string, any>) {
    this.logEvent('action', action, label, extra);
  },

  getStats() {
    const logs = getLogs();
    
    // Top Pageviews
    const pageviews: Record<string, number> = {};
    // Player Events Count
    let playCount = 0;
    let pauseCount = 0;
    let skipCount = 0;
    let downloadCount = 0;
    let voteCount = 0;

    logs.forEach(evt => {
      if (evt.type === 'pageview') {
        // Normalize search params to group cleanly
        const path = evt.metadata?.path || evt.label.split('?')[0];
        pageviews[path] = (pageviews[path] || 0) + 1;
      } else if (evt.type === 'player') {
        if (evt.action === 'play') playCount++;
        if (evt.action === 'pause') pauseCount++;
        if (evt.action === 'skip') skipCount++;
      } else if (evt.type === 'action') {
        if (evt.action === 'download') downloadCount++;
        if (evt.action === 'vote') voteCount++;
      }
    });

    const topPages = Object.entries(pageviews)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: logs.length,
      topPages,
      plays: playCount,
      pauses: pauseCount,
      skips: skipCount,
      downloads: downloadCount,
      votes: voteCount,
      recentLogs: logs.slice(0, 50),
    };
  },

  clear() {
    saveLogs([]);
  }
};
