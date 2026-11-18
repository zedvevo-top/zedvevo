import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { auth, firebaseConfig } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFirestoreCollectionCounts,
  getSourceDatabaseCounts,
  migrateAllDataToFirebase,
  type CollectionMigrationProgress,
  type FirebaseDatabaseCounts,
} from '@/services/firebaseMigration';

export function AdminFirebaseSync() {
  const { firebaseUser, signInWithGoogle } = useAuth();
  const [counts, setCounts] = useState<FirebaseDatabaseCounts | null>(null);
  const [sourceCounts, setSourceCounts] = useState<FirebaseDatabaseCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<CollectionMigrationProgress[]>([]);

  const loadCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const [fb, src] = await Promise.all([
        getFirestoreCollectionCounts(),
        getSourceDatabaseCounts(),
      ]);
      setCounts(fb);
      setSourceCounts(src);
    } catch {
      // ignore
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [firebaseUser?.uid, loadCounts]);

  const isFirebaseAdmin =
    Boolean(firebaseUser) &&
    firebaseUser?.email?.toLowerCase() === 'topkuchalo@gmail.com' &&
    firebaseUser?.emailVerified;

  const handleConnectAndSync = async () => {
    setSyncing(true);
    try {
      const currentIsAdmin =
        auth.currentUser?.email?.toLowerCase() === 'topkuchalo@gmail.com' &&
        auth.currentUser?.emailVerified;
      if (!auth.currentUser || !currentIsAdmin) {
        await signInWithGoogle();
      }
      if (
        !auth.currentUser ||
        auth.currentUser.email?.toLowerCase() !== 'topkuchalo@gmail.com'
      ) {
        toast.error('Please sign in with Google as topkuchalo@gmail.com to populate Firebase.');
        return;
      }
      const res = await migrateAllDataToFirebase((items) => setProgress(items));
      await loadCounts();
      if (res.success) {
        toast.success(`Successfully synced ${res.totalWritten} records (songs, videos, users, artists, awards & settings) to Firebase!`);
      } else {
        toast.warning(`Synced ${res.totalWritten} records with some warnings.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Firebase sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const statItems = counts
    ? [
        { label: 'Music (Songs)', fb: counts.songs, src: sourceCounts?.songs ?? 0 },
        { label: 'Videos', fb: counts.videos, src: sourceCounts?.videos ?? 0 },
        { label: 'Users (Profiles)', fb: counts.profiles, src: sourceCounts?.profiles ?? 0 },
        { label: 'Artists', fb: counts.artists, src: sourceCounts?.artists ?? 0 },
        {
          label: 'Awards & Categories',
          fb: counts.awards + counts.award_categories,
          src: (sourceCounts?.awards ?? 0) + (sourceCounts?.award_categories ?? 0),
        },
        { label: 'Nominees', fb: counts.nominees, src: sourceCounts?.nominees ?? 0 },
        { label: 'Votes', fb: counts.votes, src: sourceCounts?.votes ?? 0 },
        { label: 'Upload Plans', fb: counts.upload_plans, src: sourceCounts?.upload_plans ?? 0 },
        { label: 'Hero Banners', fb: counts.hero_banners, src: sourceCounts?.hero_banners ?? 0 },
        { label: 'App Settings', fb: counts.app_settings, src: sourceCounts?.app_settings ?? 0 },
        { label: 'Payments', fb: counts.payments, src: sourceCounts?.payments ?? 0 },
        { label: 'Weekly Trending', fb: counts.weekly_trending, src: sourceCounts?.weekly_trending ?? 0 },
      ]
    : [];

  const totalFb = statItems.reduce((sum, item) => sum + item.fb, 0);
  const totalSrc = statItems.reduce((sum, item) => sum + item.src, 0);
  const transferStatus =
    loadingCounts
      ? 'Checking…'
      : totalSrc > 0 && totalFb === 0
      ? 'Not Transferred Yet'
      : totalSrc > 0 && totalFb < totalSrc
      ? `Partial (${totalFb}/${totalSrc})`
      : totalFb > 0
      ? `Verified (${totalFb} records)`
      : 'Empty';

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            Firebase Firestore Database
            <Badge variant={isFirebaseAdmin ? 'default' : 'secondary'} className="text-[10px]">
              {isFirebaseAdmin ? 'Connected (Admin)' : firebaseUser ? 'Connected' : 'Sign in with Google to Sync'}
            </Badge>
            <Badge
              variant={totalFb > 0 && totalFb >= totalSrc ? 'default' : 'outline'}
              className={`text-[10px] ${
                totalSrc > 0 && totalFb === 0
                  ? 'border-amber-500/60 text-amber-500'
                  : totalFb > 0 && totalFb >= totalSrc
                  ? 'bg-green-600 text-white'
                  : ''
              }`}
            >
              {transferStatus}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Project: <span className="font-mono">{firebaseConfig.projectId}</span> · Database:{' '}
            <span className="font-mono">{firebaseConfig.firestoreDatabaseId}</span>
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadCounts}
            disabled={loadingCounts || syncing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingCounts ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleConnectAndSync}
            disabled={syncing}
            className="gap-1.5 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {isFirebaseAdmin
              ? 'Sync All Data, Music & Users to Firebase'
              : 'Connect Google Admin & Populate Firebase'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {statItems.map((item) => {
            const synced = item.src === 0 || item.fb >= item.src;
            return (
              <div
                key={item.label}
                className="rounded-lg border border-border/60 bg-background/60 px-3 py-2"
              >
                <div className="text-[11px] text-muted-foreground truncate">{item.label}</div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-base font-bold text-foreground">
                    {loadingCounts ? '…' : item.fb.toLocaleString()}
                  </span>
                  {!loadingCounts && item.src > 0 && (
                    <span
                      className={`text-[10px] font-mono ${
                        synced ? 'text-green-500' : 'text-amber-500'
                      }`}
                    >
                      / {item.src.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {progress.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50">
            {progress.map((p) => (
              <div
                key={p.collection}
                className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-2.5 py-1.5"
              >
                <span className="font-mono truncate mr-2">{p.collection}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {p.status === 'syncing' && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
                  {p.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  {p.status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
                  <span>
                    {p.written}/{p.fetched}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminFirebaseSync;
