import { useState, useRef } from 'react';
import { Heart, Loader2, Smartphone, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { processUnifiedPayment, listenForPaymentStatus } from '@/lib/paymentProcessor';
import PaymentStatusOverlay from '@/components/payment/PaymentStatusOverlay';

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

interface DonationDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'form' | 'pending' | 'done' | 'error';

export default function DonationDialog({ open, onClose }: DonationDialogProps) {
  const [amount, setAmount] = useState('10');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [donorName, setDonorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [polling, setPolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };

  const resetForm = () => {
    stopPolling();
    setStep('form');
    setErrorMsg('');
    setActivePaymentId(null);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  // Mirror the upload page's pollPayment: setInterval every 5s, max 30 attempts
  const pollStatus = (pid: string) => {
    setPolling(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { data: payment } = await supabase
          .from('payments')
          .select('status, failure_reason')
          .eq('id', pid)
          .maybeSingle();

        const status = payment?.status;

        if (status === 'completed' || status === 'successful') {
          stopPolling();
          setStep('done');
          toast.success('Donation confirmed! Thank you for supporting ZedVevo.');
          setTimeout(() => { resetForm(); onClose(); }, 3000);
          return;
        }

        if (status === 'failed' || status === 'insufficient_funds' || status === 'cancelled') {
          stopPolling();
          const reason = payment?.failure_reason
            ?? (status === 'insufficient_funds'
              ? 'Insufficient funds — please top up and try again.'
              : 'Payment failed. Please try again.');
          setErrorMsg(reason);
          setStep('error');
          toast.error(reason);
          return;
        }
      } catch { /* keep polling on transient errors */ }

      if (attempts >= 30) {
        stopPolling();
        toast.info('Still waiting for confirmation. Your payment may still go through — check your mobile money app.');
      }
    }, 5000);
  };

  const handleDonate = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 1) { toast.error('Minimum donation is 1 ZMW'); return; }
    const rawPhone = phone.trim();
    if (!rawPhone) { toast.error('Enter your mobile money number'); return; }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await processUnifiedPayment({
        amount: parsed,
        payment_method: 'mobile_money',
        phone_number: rawPhone,
        description: message.trim() || 'ZedVevo donation',
        payment_type: 'donation',
        metadata: {
          donor_name: donorName.trim() || null,
          message: message.trim() || null,
          guest_phone: rawPhone,
        },
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Payment failed.');
        setStep('error');
        toast.error(result.error || 'Payment failed.');
        setLoading(false);
        return;
      }

      if (result.status === 'completed' || result.status === 'successful') {
        setStep('done');
        toast.success('Thank you for your donation!');
        setLoading(false);
        return;
      }

      // STRICT PENDING STATE
      setActivePaymentId(result.payment_id || null);
      setStep('pending');
      toast.info('Mobile Money prompt sent! Enter your PIN on your phone to complete the donation.');

      listenForPaymentStatus(result.payment_id!, (statusRes) => {
        if (statusRes.status === 'completed') {
          setStep('done');
          toast.success('Thank you for your donation! Lipila confirmed payment.');
        } else if (statusRes.status === 'failed') {
          setErrorMsg(statusRes.failure_reason || 'Payment failed or was declined on phone.');
          setStep('error');
          toast.error(statusRes.failure_reason || 'Payment failed or was declined.');
        }
        setLoading(false);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      setErrorMsg(msg);
      setStep('error');
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive fill-destructive" />
            Support ZedVevo
          </DialogTitle>
          <DialogDescription>
            {step === 'form'
              ? 'Donate any amount via mobile money. A PIN prompt will be sent to your phone.'
              : step === 'pending'
              ? 'Waiting for your mobile money PIN confirmation…'
              : step === 'error'
              ? 'The payment could not be completed.'
              : 'Thank you for your donation!'}
          </DialogDescription>
        </DialogHeader>

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <div className="space-y-4 pt-1">
            {/* Quick amounts */}
            <div>
              <Label className="mb-2 block">Amount (ZMW)</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      amount === String(a)
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                    }`}
                  >
                    K{a}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <Label htmlFor="donation-amount">Custom amount (ZMW)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">K</span>
                <Input
                  id="donation-amount"
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Phone number */}
            <div>
              <Label htmlFor="donation-phone">Mobile money number <span className="text-destructive">*</span></Label>
              <div className="relative mt-1">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="donation-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0971 234 567 or 260971234567"
                  className="pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">MTN, Airtel or Zamtel number</p>
            </div>

            {/* Optional name */}
            <div>
              <Label htmlFor="donor-name">Your name (optional)</Label>
              <Input
                id="donor-name"
                value={donorName}
                onChange={e => setDonorName(e.target.value)}
                placeholder="Anonymous"
                className="mt-1"
              />
            </div>

            {/* Optional message */}
            <div>
              <Label htmlFor="donation-message">Message (optional)</Label>
              <Textarea
                id="donation-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Keep up the great work!"
                className="mt-1 resize-none"
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleDonate}
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending request…</>
                : <><Heart className="h-4 w-4 mr-2" />Donate K{parseFloat(amount || '0').toFixed(0)} via Mobile Money</>
              }
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              Powered by Lipila · Zambian mobile money · ZMW only
            </p>
          </div>
        )}

        {/* Centralized Payment Status Overlay */}
        {(step === 'pending' || step === 'done' || step === 'error') && (
          <PaymentStatusOverlay
            status={
              step === 'pending' ? 'pending' :
              step === 'done' ? 'success' :
              'failed'
            }
            amount={parseFloat(amount || '0')}
            description={message ? `Donation: ${message}` : 'Donation to ZedVevo'}
            phone={phone}
            failureReason={errorMsg}
            onClose={handleClose}
            onRetry={resetForm}
            paymentId={activePaymentId || undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
