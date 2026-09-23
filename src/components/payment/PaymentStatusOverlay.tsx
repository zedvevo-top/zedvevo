import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/db/supabase';

interface PaymentStatusOverlayProps {
  status: 'pending' | 'success' | 'failed' | null;
  amount: number;
  description: string;
  phone?: string;
  failureReason?: string;
  onClose: () => void;
  onRetry?: () => void;
  paymentId?: string;
  onSimulate?: (simStatus: 'completed' | 'failed') => void;
}

export default function PaymentStatusOverlay({
  status,
  amount,
  description,
  phone,
  failureReason,
  onClose,
  onRetry,
  paymentId,
  onSimulate
}: PaymentStatusOverlayProps) {
  const [simulating, setSimulating] = React.useState(false);
  const [dbStatus, setDbStatus] = React.useState<string | null>(null);
  const [dbFailureReason, setDbFailureReason] = React.useState<string | null>(null);

  // Watch status in the database in real-time
  React.useEffect(() => {
    if (!paymentId) return;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);

    const fetchRecord = async () => {
      try {
        let query = supabase.from('payments').select('*');
        if (isUuid) {
          query = query.eq('id', paymentId);
        } else {
          query = query.or(`lipila_transaction_id.eq.${paymentId},lipila_reference.eq.${paymentId},external_id.eq.${paymentId}`);
        }
        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          setDbStatus(data.status);
          setDbFailureReason(data.failure_reason);
        }
      } catch (err) {
        console.warn('[Overlay Watcher] Error fetching status:', err);
      }
    };

    fetchRecord();
    const interval = setInterval(fetchRecord, 1500);

    // Also listen to realtime updates on payments table
    let channel: any;
    if (isUuid) {
      channel = supabase
        .channel(`overlay_realtime_watch_${paymentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payments',
            filter: `id=eq.${paymentId}`,
          },
          (payload) => {
            const p = payload.new as any;
            if (p) {
              setDbStatus(p.status);
              setDbFailureReason(p.failure_reason);
            }
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [paymentId]);

  if (!status) return null;

  const handleSimulateUpdate = async (simStatus: 'completed' | 'failed') => {
    if (onSimulate) {
      onSimulate(simStatus);
      return;
    }

    if (!paymentId) return;
    setSimulating(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
      let query = supabase.from('payments').update({
        status: simStatus,
        failure_reason: simStatus === 'failed' ? 'Simulated mobile network PIN decline.' : null,
        completed_at: simStatus === 'completed' ? new Date().toISOString() : null
      });

      if (isUuid) {
        query = query.eq('id', paymentId);
      } else {
        query = query.or(`lipila_transaction_id.eq.${paymentId},lipila_reference.eq.${paymentId},external_id.eq.${paymentId}`);
      }

      await query;
      // Instantly reflect simulated status locally
      setDbStatus(simStatus);
      if (simStatus === 'failed') {
        setDbFailureReason('Simulated mobile network PIN decline.');
      }
    } catch (err) {
      console.warn('[Simulation] Error updating payment record:', err);
    } finally {
      setSimulating(false);
    }
  };

  // Map database status or prop status to display mode
  const rawStatus = dbStatus || (
    status === 'success' ? 'completed' :
    status === 'failed' ? 'failed' :
    'pending'
  );

  const displayStatus: 'pending' | 'success' | 'failed' =
    (rawStatus === 'completed' || rawStatus === 'successful') ? 'success' :
    (['failed', 'declined', 'cancelled', 'insufficient_funds'].includes(rawStatus)) ? 'failed' :
    'pending';

  const activeFailureReason = dbFailureReason || failureReason;

  const showSimulate = displayStatus === 'pending' && (paymentId || onSimulate);

  return (
    <div className="absolute inset-0 bg-background/98 backdrop-blur-md z-50 flex flex-col justify-between p-6 animate-in fade-in duration-200">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-6">
        
        {/* ── PENDING STATE ── */}
        {displayStatus === 'pending' && (
          <div className="space-y-5">
            <div className="text-center space-y-3">
              <div className="relative h-16 w-16 mx-auto flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500/20 opacity-75" />
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                  <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground tracking-tight">Payment is Pending</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  We sent a secure mobile money PIN request to <strong className="text-foreground">{phone || 'your phone'}</strong> for <strong className="text-accent">{formatCurrency(amount)}</strong>.
                </p>
              </div>
            </div>

            {/* Sandbox Simulation Buttons */}
            {showSimulate && (
              <div className="bg-accent/5 rounded-xl border border-dashed border-accent/20 p-3 text-center space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                <p className="text-[10px] font-bold tracking-wide text-accent uppercase">💡 Developer Simulation Controls</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={simulating}
                    className="flex-1 text-[11px] h-8 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                    onClick={() => handleSimulateUpdate('completed')}
                  >
                    {simulating ? 'Simulating...' : 'Simulate Success'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={simulating}
                    className="flex-1 text-[11px] h-8 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                    onClick={() => handleSimulateUpdate('failed')}
                  >
                    Simulate Failure
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground">Force immediate database update to verify client integration behavior.</p>
              </div>
            )}

            {/* Step Wizard Checklist */}
            <div className="bg-muted/60 p-4 rounded-xl border border-border/50 space-y-3.5 text-left">
              <h4 className="text-[11px] font-bold text-accent uppercase tracking-wider">Next Steps to Complete:</h4>
              <ul className="space-y-3 text-xs text-foreground/90">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">1</span>
                  <span><strong>Look at your phone:</strong> Keep your mobile phone unlocked. A pop-up prompt asking for your PIN should appear.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">2</span>
                  <span><strong>Enter your PIN:</strong> Securely authorize the transaction of {formatCurrency(amount)} using your mobile wallet PIN.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">3</span>
                  <span><strong>Keep this open:</strong> Our real-time listener will instantly confirm and activate your purchase here.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground justify-center border border-border/20">
              <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
              <span>Secured by Lipila Real-time Payment Webhooks</span>
            </div>
          </div>
        )}

        {/* ── SUCCESS STATE ── */}
        {displayStatus === 'success' && (
          <div className="space-y-5 text-center animate-in zoom-in-95 duration-300">
            <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-foreground tracking-tight">Payment Successful!</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Thank you! Your transaction has been confirmed and fully processed.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 text-left space-y-2">
              <div className="flex justify-between text-xs py-1 border-b border-border/30">
                <span className="text-muted-foreground">Description</span>
                <span className="font-medium text-foreground truncate max-w-[180px]">{description}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-border/30">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-bold text-emerald-500">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-emerald-500">Completed (Original: {rawStatus})</span>
              </div>
            </div>
          </div>
        )}

        {/* ── FAILED STATE ── */}
        {displayStatus === 'failed' && (
          <div className="space-y-5 text-center animate-in zoom-in-95 duration-300">
            <div className="h-16 w-16 bg-destructive/10 border border-destructive/30 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-foreground tracking-tight">Transaction Failed</h3>
              <p className="text-xs text-destructive/90 bg-destructive/5 py-1 px-2 rounded-lg border border-destructive/10 max-w-xs mx-auto">
                {activeFailureReason || 'Declined or timed out. Please try again.'}
              </p>
            </div>

            {/* Troubleshooting Note */}
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 text-left space-y-2.5">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-accent" /> Status: {rawStatus}
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                <li>Ensure you have enough balance in your wallet.</li>
                <li>Make sure your phone signal is stable to receive prompts.</li>
                <li>Verify your PIN was typed correctly on your handset.</li>
              </ul>
            </div>
          </div>
        )}

      </div>

      {/* ── FIXED BOTTOM ACTIONS ── */}
      <div className="pt-4 border-t border-border/50 max-w-sm mx-auto w-full flex gap-2">
        {displayStatus === 'pending' && (
          <Button variant="outline" className="w-full text-xs h-10 font-medium" onClick={onClose}>
            Close & Verify in Background
          </Button>
        )}
        {displayStatus === 'success' && (
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-10 font-semibold" onClick={onClose}>
            Continue
          </Button>
        )}
        {displayStatus === 'failed' && (
          <>
            <Button variant="outline" className="flex-1 text-xs h-10" onClick={onClose}>
              Cancel
            </Button>
            {onRetry && (
              <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-10 font-semibold" onClick={onRetry}>
                Try Again
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
