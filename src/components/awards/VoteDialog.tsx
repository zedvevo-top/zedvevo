import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, Trophy, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { applyPaymentBenefits } from '@/lib/api';
import { processUnifiedPayment } from '@/lib/paymentProcessor';
import { generateIdempotencyKey, formatCurrency } from '@/lib/utils';
import CardPaymentForm from '@/components/payment/CardPaymentForm';
import type { Nominee } from '@/types/index';

interface VoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nominee: Nominee | null;
  pricePerVote?: number;
  onVoteSuccess?: () => void;
}

type PaymentFlowState = 'idle' | 'initiating' | 'checking' | 'successful' | 'failed' | 'pending';

export default function VoteDialog({
  open,
  onOpenChange,
  nominee,
  pricePerVote = 5,
  onVoteSuccess,
}: VoteDialogProps) {
  const { user } = useAuth();

  const [voteCount, setVoteCount] = useState<number>(1);
  const [payMethod, setPayMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [phone, setPhone] = useState('');
  const [flowState, setFlowState] = useState<PaymentFlowState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  const pollTimerRef = useRef<any | null>(null);
  const pollCountRef = useRef<number>(0);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setVoteCount(1);
      setPayMethod('mobile_money');
      setPhone(user?.phone || '');
      setFlowState('idle');
      setStatusMessage('');
      setActivePaymentId(null);
      pollCountRef.current = 0;
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [open, user]);

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  if (!nominee) return null;

  const totalAmount = voteCount * pricePerVote;

  const presetCounts = [1, 5, 10, 20, 50, 100];

  const handleStartVote = async () => {
    if (voteCount < 1) {
      toast.error('Please select at least 1 vote');
      return;
    }
    if (payMethod === 'mobile_money' && !phone.trim()) {
      toast.error('Please enter your mobile money phone number');
      return;
    }

    setFlowState('initiating');
    setStatusMessage('Processing Lipila payment...');

    try {
      const result = await processUnifiedPayment({
        amount: totalAmount,
        payment_method: payMethod,
        phone_number: payMethod === 'mobile_money' ? phone.trim() : undefined,
        description: `Vote: ${voteCount} vote(s) for ${nominee.name}`,
        payment_type: 'vote',
        user_id: user?.id || null,
        metadata: {
          nominee_id: nominee.id,
          category_id: nominee.category_id,
          vote_count: voteCount,
          user_id: user?.id || null,
        },
      });

      if (!result.success) {
        setFlowState('failed');
        setStatusMessage(result.error || 'Payment failed — no votes were added.');
        toast.error(result.error || 'Payment failed.');
        return;
      }

      setFlowState('successful');
      setStatusMessage('Payment successful — votes confirmed.');
      toast.success(`Thank you! ${voteCount} vote(s) confirmed for ${nominee.name}.`);
      onVoteSuccess?.();
    } catch (err: unknown) {
      setFlowState('failed');
      const msg = (err as Error).message || 'Failed to process payment';
      setStatusMessage(msg);
      toast.error(msg);
    }
  };

  const startPaymentPolling = (paymentId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollCountRef.current = 0;

    // Also listen via realtime channel for fast update
    const channel = supabase
      .channel(`payment_status_${paymentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments', filter: `id=eq.${paymentId}` },
        async (payload) => {
          const updated = payload.new as { status: string };
          if (updated.status === 'completed' || updated.status === 'successful') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            await applyPaymentBenefits(paymentId).catch(console.error);
            setFlowState('successful');
            setStatusMessage('Payment successful — votes confirmed.');
            toast.success('Payment verified! Your votes are counted.');
            onVoteSuccess?.();
          } else if (['failed', 'cancelled', 'insufficient_funds'].includes(updated.status)) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            await applyPaymentBenefits(paymentId).catch(console.error);
            setFlowState('failed');
            setStatusMessage('Payment failed — no votes were added.');
          }
        }
      )
      .subscribe();

    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      try {
        const { data, error } = await supabase
          .from('payments')
          .select('status, failure_reason')
          .eq('id', paymentId)
          .maybeSingle();

        if (!error && data) {
          if (data.status === 'completed' || data.status === 'successful') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            supabase.removeChannel(channel);
            await applyPaymentBenefits(paymentId).catch(console.error);
            setFlowState('successful');
            setStatusMessage('Payment successful — votes confirmed.');
            toast.success(`Success! ${voteCount} vote(s) recorded.`);
            onVoteSuccess?.();
            return;
          }

          if (['failed', 'cancelled', 'insufficient_funds'].includes(data.status)) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            supabase.removeChannel(channel);
            await applyPaymentBenefits(paymentId).catch(console.error);
            setFlowState('failed');
            setStatusMessage(
              data.failure_reason
                ? `Payment failed: ${data.failure_reason} — no votes were added.`
                : 'Payment failed — no votes were added.'
            );
            return;
          }
        }

        // Timeout after 60 seconds (24 polls * 2.5s)
        if (pollCountRef.current >= 24) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          supabase.removeChannel(channel);
          setFlowState('pending');
          setStatusMessage('Payment pending — votes are not counted yet.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2500);
  };

  const handleClose = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md p-6 rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">ZedVevo Official Awards</span>
          </div>
          <DialogTitle className="text-xl font-bold">Vote for {nominee.name}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Support your artist. Unregistered visitors and guests can vote freely.
          </DialogDescription>
        </DialogHeader>

        {/* Nominee Summary Card */}
        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border/60">
          <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
            {nominee.photo_url ? (
              <img src={nominee.photo_url} alt={nominee.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-muted-foreground/40 text-xl">
                {nominee.name[0]}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{nominee.name}</p>
            {nominee.song_title && (
              <p className="text-xs text-muted-foreground truncate">{nominee.song_title}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] px-2 py-0 border-accent/40 text-accent font-medium">
                {nominee.total_votes.toLocaleString()} Confirmed Votes
              </Badge>
            </div>
          </div>
        </div>

        {/* Payment Flow State Views */}
        {flowState === 'idle' && (
          <div className="space-y-4 pt-1">
            {/* Price Rule Banner */}
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground">Official Rate</span>
                <p className="text-xs text-muted-foreground">1 Vote = {formatCurrency(pricePerVote)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-accent">
                  Total = {formatCurrency(totalAmount)}
                </span>
                <p className="text-[11px] text-muted-foreground">({voteCount} votes)</p>
              </div>
            </div>

            {/* Vote selection presets */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Select Number of Votes</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {presetCounts.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setVoteCount(count)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all text-center ${
                      voteCount === count
                        ? 'border-accent bg-accent/15 text-accent font-bold ring-1 ring-accent'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {count} {count === 1 ? 'Vote' : 'Votes'}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {formatCurrency(count * pricePerVote)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom vote count input */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Custom Vote Quantity</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={voteCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVoteCount(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="mt-1 text-sm font-semibold h-9"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                If user selects {voteCount} votes: Total = {formatCurrency(totalAmount)}
              </p>
            </div>

            {/* Payment method */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Payment Method</Label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v as 'mobile_money' | 'card')}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money (MTN, Airtel, Zamtel)</SelectItem>
                  <SelectItem value="card">Bank / Debit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payMethod === 'card' ? (
              <div className="pt-2 border-t border-border/50">
                <CardPaymentForm
                  amount={totalAmount}
                  paymentType="vote"
                  metadata={{
                    nominee_id: nominee.id,
                    category_id: nominee.category_id,
                    vote_count: voteCount,
                    user_id: user?.id || null,
                  }}
                  onSuccess={(paymentId) => {
                    setFlowState('successful');
                    onVoteSuccess?.();
                  }}
                  onCancel={handleClose}
                  buttonLabel={`Secure Pay ${formatCurrency(totalAmount)} & Cast ${voteCount} ${voteCount === 1 ? 'Vote' : 'Votes'}`}
                />
              </div>
            ) : (
              <>
                {/* Phone number */}
                {payMethod === 'mobile_money' && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Mobile Money Number *</Label>
                    <Input
                      type="tel"
                      placeholder="e.g. 0977123456 or 260977123456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 text-sm h-9"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      You will receive an MNO push prompt on this device to authorize payment.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
                  <span>Only backend verification of a successful Lipila payment creates valid votes.</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Initiating State */}
        {flowState === 'initiating' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
            <h3 className="font-semibold text-sm">Connecting to Lipila...</h3>
            <p className="text-xs text-muted-foreground">Please wait while your payment prompt is prepared.</p>
          </div>
        )}

        {/* Checking Payment State */}
        {flowState === 'checking' && (
          <div className="py-8 text-center space-y-4">
            <div className="relative h-14 w-14 mx-auto flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/20 opacity-75" />
              <Loader2 className="h-8 w-8 animate-spin text-accent relative z-10" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Checking payment...</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Please approve the mobile prompt on your phone for {formatCurrency(totalAmount)}.
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground border border-border/50 max-w-xs mx-auto">
              Votes are only counted after Lipila confirms your payment server-side.
            </div>
          </div>
        )}

        {/* Successful State */}
        {flowState === 'successful' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="font-bold text-lg text-foreground">Payment successful — votes confirmed.</h3>
            <p className="text-xs text-muted-foreground">
              {voteCount} vote(s) for <strong>{nominee.name}</strong> have been recorded in Supabase.
            </p>
          </div>
        )}

        {/* Failed State */}
        {flowState === 'failed' && (
          <div className="py-8 text-center space-y-3">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h3 className="font-bold text-base text-destructive">Payment failed — no votes were added.</h3>
            <p className="text-xs text-muted-foreground px-4">{statusMessage}</p>
          </div>
        )}

        {/* Pending / Timed Out State */}
        {flowState === 'pending' && (
          <div className="py-8 text-center space-y-3">
            <Clock className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="font-bold text-base text-amber-500">Payment pending — votes are not counted yet.</h3>
            <p className="text-xs text-muted-foreground px-4">
              If your payment succeeds on your phone shortly, Supabase will automatically record the votes via webhook.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {flowState === 'idle' && payMethod === 'mobile_money' && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-5"
                onClick={handleStartVote}
              >
                Pay {formatCurrency(totalAmount)} & Cast {voteCount} {voteCount === 1 ? 'Vote' : 'Votes'}
              </Button>
            </>
          )}

          {flowState === 'checking' && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleClose}>
              Check in Background
            </Button>
          )}

          {flowState === 'successful' && (
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground w-full"
              onClick={handleClose}
            >
              Done
            </Button>
          )}

          {(flowState === 'failed' || flowState === 'pending') && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => setFlowState('idle')}
              >
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
