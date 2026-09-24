import { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  requestAdminNotificationPermission,
  getAdminNotificationPermission,
  showAdminPopNotification,
  type NotificationPermissionState,
} from '@/services/adminNotificationService';

export function AdminNotificationControl() {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setPermission(getAdminNotificationPermission());
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    const result = await requestAdminNotificationPermission();
    setPermission(result);
    setRequesting(false);
  };

  const handleTest = () => {
    showAdminPopNotification('🔔 ZedVevo Admin Alert (Test)', {
      body: 'Pop-up notifications are functioning properly! You will receive alerts when songs, nominees, and votes occur.',
      tag: 'test-admin-alert',
    });
  };

  return (
    <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Background Pop-up Notifications</CardTitle>
              <CardDescription className="text-xs">
                Receive instant system pop-ups for new songs, nominees, and votes even when using other apps.
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={permission === 'granted' ? 'default' : 'secondary'}
            className={
              permission === 'granted'
                ? 'bg-emerald-600/90 text-white font-medium'
                : 'text-muted-foreground'
            }
          >
            {permission === 'granted' ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3" /> Pop-ups Active
              </span>
            ) : permission === 'denied' ? (
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3" /> Permission Blocked
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Bell className="h-3 w-3" /> Action Required
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">Trigger Events Monitored:</p>
            <p className="text-muted-foreground">
              • Every song uploaded &nbsp;|&nbsp; • New award nominee entries &nbsp;|&nbsp; • Every vote cast for nominees
            </p>
          </div>
          <div className="flex items-center gap-2">
            {permission !== 'granted' ? (
              <Button
                size="sm"
                onClick={handleEnable}
                disabled={requesting}
                className="gap-1.5 font-medium shadow-sm"
              >
                <BellRing className="h-3.5 w-3.5" />
                {requesting ? 'Enabling...' : 'Enable Pop-up Alerts'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                className="gap-1.5 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Test Pop-up Message
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
