import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, CheckCircle2, Zap, Star, Crown, Phone, Loader2, 
  CreditCard, ShieldCheck, ArrowRight, RefreshCw, Check, Repeat, Music2, Sparkles, Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { processUnifiedPayment, listenForPaymentStatus } from '@/lib/paymentProcessor';
import { applyPaymentBenefits, getActivePlans } from '@/lib/api';
import { detectNetwork } from '@/services/lipila';
import CardPaymentForm from '@/components/payment/CardPaymentForm';
import type { UploadPlan, UserSubscription, PaymentStatus } from '@/types/index';
import { toast } from 'sonner';

export type PlanKey = 'k10_single' | 'k100_weekly' | 'k300_yearly';

export interface PlanRenewalDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  subscription?: UserSubscription | null;
  expiredReason?: string;
}

interface PlanOption {
  id: PlanKey;
  name: string;
  typeTag: 'single' | 'unlimited';
  badgeText: string;
  badgeClass: string;
  price: number;
  period: string;
  icon: any;
  description: string;
  features: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
}

const DEFAULT_PLANS: PlanOption[] = [
  {
    id: 'k10_single',
    name: 'Single Track Pass',
    typeTag: 'single',
    badgeText: '⚡ SINGLE UPLOAD',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    price: 10,
    period: '1 Song or Video',
    icon: Music2,
    description: 'Upload 1 single track or music video with instant live publishing on ZedVevo.',
    features: [
      '1 Song (MP3) or Video (MP4) Upload',
      'Instant Live Streaming on ZedVevo',
      'Play Count & Download Analytics',
      'Direct Social Share Links',
    ],
  },
  {
    id: 'k100_weekly',
    name: 'Weekly Creator Pass',
    typeTag: 'unlimited',
    badgeText: '🔥 UNLIMITED 7 DAYS',
    badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    price: 100,
    period: '7 Days Unlimited',
    icon: Repeat,
    description: 'Unlimited uploads for 7 days + FreshTunes global distribution (Spotify, Apple Music).',
    features: [
      'Unlimited Song & Video Uploads for 7 Days',
      'FreshTunes Global Streaming Distribution',
      'Priority Content Review (< 2 Hours)',
      'Detailed Demographics & Revenue Analytics',
      '100% Royalty Profit Rights',
    ],
    isPopular: true,
  },
  {
    id: 'k300_yearly',
    name: 'Annual Pro VIP Pass',
    typeTag: 'unlimited',
    badgeText: '👑 UNLIMITED 365 DAYS',
    badgeClass: 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-sm',
    price: 300,
    period: '365 Days Unlimited',
    icon: Crown,
    description: 'Unlimited uploads for 1 Year + Verified Artist Badge & Homepage Spotlight.',
    features: [
      'Unlimited Uploads for 1 Full Year (365 Days)',
      'All Streaming Platforms via FreshTunes VIP',
      'Official Blue Verified Artist Badge',
      'ZedVevo Awards Nominee Eligibility',
      'Homepage Featured Artist Banner',
    ],
    isBestValue: true,
  },
];

export default function PlanRenewalDialog({
  open,
  onOpenChange,
  onSuccess,
  subscription,
  expiredReason,
}: PlanRenewalDialogProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>('k100_weekly');
  const [payMethod, setPayMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [phone, setPhone] = useState<string>('');
  const [dbPlans, setDbPlans] = useState<UploadPlan[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Auto-populate phone from user profile
  useEffect(() => {
    if (profile?.phone && !phone) {
      const raw = profile.phone.replace(/\D/g, '');
      setPhone(raw.startsWith('0') ? '260' + raw.slice(1) : raw);
    }
  }, [profile, phone]);

  // Load database plans if available
  useEffect(() => {
    if (open) {
      getActivePlans()
        .then((plans) => {
          if (plans && plans.length > 0) {
            setDbPlans(plans);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.startsWith('0')) {
      value = '260' + value.substring(1);
    }
    setPhone(value);
  };

  const network = phone ? detectNetwork(phone) : null;
  const currentPlanObj = DEFAULT_PLANS.find((p) => p.id === selectedPlanKey) || DEFAULT_PLANS[1];

  const handleInitiatePayment = async () => {
    if (!user) {
      toast.error('Please log in to renew your plan');
      return;
    }

    if (payMethod === 'mobile_money') {
      if (!phone || phone.length < 9) {
        toast.error('Please enter a valid Zambian Mobile Money phone number (e.g., 097xxxxxxx)');
        return;
      }
    }

    setIsProcessing(true);
    setPaymentStatus('pending');
    setStatusMessage(`Sending PIN prompt to your phone for ${formatCurrency(currentPlanObj.price)}...`);

    try {
      const matchingDbPlan = dbPlans.find((p) => p.plan_type === currentPlanObj.id) || dbPlans[0];

      const result = await processUnifiedPayment({
        amount: currentPlanObj.price,
        payment_method: payMethod,
        phone_number: payMethod === 'mobile_money' ? phone : undefined,
        description: `ZedVevo ${currentPlanObj.name}`,
        payment_type: 'plan',
        plan_id: matchingDbPlan?.id,
        user_id: user.id,
        metadata: {
          user_id: user.id,
          plan_type: currentPlanObj.id,
          plan_id: matchingDbPlan?.id,
        },
      });

      if (!result.success) {
        setPaymentStatus('failed');
        setStatusMessage(result.error || 'Payment request failed. Please check your phone number and try again.');
        setIsProcessing(false);
        return;
      }

      if (result.status === 'completed' || result.status === 'successful') {
        if (result.payment_id) {
          await applyPaymentBenefits(result.payment_id).catch(() => {});
        }
        await refreshProfile();
        setPaymentStatus('completed');
        toast.success(`🎉 ${currentPlanObj.name} activated! You can now upload content.`);
        setIsProcessing(false);
        if (onSuccess) onSuccess();
        if (onOpenChange) onOpenChange(false);
        return;
      }

      if (result.payment_id) {
        listenForPaymentStatus(result.payment_id, async (statusRes) => {
          if (statusRes.status === 'completed' || statusRes.status === 'successful') {
            await applyPaymentBenefits(result.payment_id).catch(() => {});
            await refreshProfile();
            setPaymentStatus('completed');
            toast.success(`🎉 Payment verified! ${currentPlanObj.name} is now active.`);
            if (onSuccess) onSuccess();
            if (onOpenChange) onOpenChange(false);
          } else if (statusRes.status === 'failed') {
            setPaymentStatus('failed');
            setStatusMessage(statusRes.failure_reason || 'Payment failed or was declined on your phone.');
          }
          setIsProcessing(false);
        });
      }
    } catch (err: any) {
      setPaymentStatus('failed');
      setStatusMessage(err.message || 'Payment initiation failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const isOneTimeSub = subscription?.plan_type === 'k10_single' || subscription?.uploads_allowed === 1;
  const previousPlanName = subscription?.upload_plans?.name || (isOneTimeSub ? 'K10 Single Upload' : 'Artist Pass');
  const usedCount = subscription?.uploads_used || 0;
  const allowedCount = subscription?.uploads_allowed;
  const expiresAt = subscription?.expires_at;

  const statusHeadline = isOneTimeSub 
    ? 'Single Upload Token Consumed' 
    : 'Artist Upload Subscription Expired';

  const defaultReason = expiredReason || (
    isOneTimeSub 
      ? `Your 1-song upload pass was consumed on your track release. Select a new plan (K10 Single or K100 Unlimited) to upload your next release.` 
      : expiresAt 
        ? `Your artist subscription expired on ${formatDate(expiresAt)}. Select an upload plan below to unlock uploading.` 
        : `All artist uploads require an active plan. Admins upload free, but artists require a verified plan to upload.`
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-3xl bg-card border-border text-foreground max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl z-50 backdrop-blur-xl"
      >
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-extrabold text-foreground">
                  {statusHeadline}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Free uploads are reserved for Admins. Select a plan below to activate instant uploading.
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-destructive text-destructive-foreground font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 shrink-0">
              STATUS: EXPIRED
            </Badge>
          </div>
        </DialogHeader>

        {/* Expired User Status Banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Artist Account: </span>
              <strong className="text-foreground font-semibold">
                {profile?.display_name || profile?.username || user?.email || 'Artist User'}
              </strong>
            </div>
            <div>
              <span className="text-muted-foreground">Previous Plan: </span>
              <strong className="text-amber-500 font-bold">{previousPlanName}</strong>
            </div>
            {allowedCount != null && (
              <div>
                <span className="text-muted-foreground">Upload Quota: </span>
                <strong className="text-destructive font-mono font-bold">
                  {usedCount} / {allowedCount} Used
                </strong>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pt-1.5 border-t border-amber-500/20">
            {defaultReason}
          </p>
        </div>

        {/* Grid Layout for Plan Options */}
        <div className="space-y-3 my-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              <span>Select Plan to Resume Uploading:</span>
            </h3>
            <span className="text-[11px] text-muted-foreground italic">Instant mobile activation</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {DEFAULT_PLANS.map((plan) => {
              const Icon = plan.icon;
              const isSelected = selectedPlanKey === plan.id;
              const isSingle = plan.typeTag === 'single';

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanKey(plan.id)}
                  className={`relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-lg ring-2 ring-primary/40 -translate-y-0.5'
                      : 'border-border/70 bg-card hover:border-primary/40 hover:bg-card/90 shadow-sm'
                  }`}
                >
                  {/* Badge distinguishing Single vs Unlimited */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge className={`text-[9px] font-extrabold uppercase py-0.5 px-2.5 shadow-sm border ${plan.badgeClass}`}>
                      {plan.badgeText}
                    </Badge>
                  </div>

                  <div>
                    {/* Header Icon + Checkbox */}
                    <div className="flex items-center justify-between mb-2 pt-1">
                      <div className={`p-2 rounded-xl flex items-center justify-center ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground shadow-xs' 
                          : isSingle ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-foreground">{plan.name}</h4>
                    
                    {/* Type Tag indicator */}
                    <div className="my-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSingle ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {isSingle ? 'Single Release (1 Track)' : 'Unlimited Uploads'}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{plan.description}</p>
                    
                    <div className="my-2.5 pt-2 border-t border-border/50">
                      <span className="text-2xl font-black text-foreground">{formatCurrency(plan.price)}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold ml-1">/{plan.period}</span>
                    </div>

                    <ul className="space-y-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      {plan.features.slice(0, 3).map((feat, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    className={`mt-4 w-full font-bold text-xs h-8 ${
                      isSelected ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs' : ''
                    }`}
                  >
                    {isSelected ? 'Selected Plan' : `Select ${formatCurrency(plan.price)}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Checkout Panel */}
        <div className="rounded-2xl border border-border bg-card/80 p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Checkout: <strong className="text-primary">{currentPlanObj.name}</strong></span>
            </span>
            <span className="text-base font-black text-emerald-500">
              {formatCurrency(currentPlanObj.price)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={payMethod === 'mobile_money' ? 'default' : 'outline'}
                onClick={() => setPayMethod('mobile_money')}
                className="h-9 text-xs font-semibold gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> Mobile Money (Lipila)
              </Button>
              <Button
                type="button"
                variant={payMethod === 'card' ? 'default' : 'outline'}
                onClick={() => setPayMethod('card')}
                className="h-9 text-xs font-semibold gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" /> Credit / Debit Card
              </Button>
            </div>

            {payMethod === 'mobile_money' ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Mobile Money Number:</label>
                  {network && (
                    <Badge className="text-[9px] uppercase font-bold bg-primary/20 text-primary border-0">
                      {network.toUpperCase()} Detected
                    </Badge>
                  )}
                </div>
                <Input
                  type="tel"
                  placeholder="e.g. 097xxxxxxx or 076xxxxxxx"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="h-10 text-xs bg-background border-border"
                />
                <Button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleInitiatePayment}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 text-xs gap-2 shadow-md"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Confirming PIN on phone...
                    </>
                  ) : (
                    <>
                      <span>Pay {formatCurrency(currentPlanObj.price)} with Lipila</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="pt-1">
                <CardPaymentForm
                  amount={currentPlanObj.price}
                  paymentType="plan"
                  metadata={{
                    user_id: user?.id,
                    plan_type: currentPlanObj.id,
                  }}
                  onSuccess={async (paymentId) => {
                    await applyPaymentBenefits(paymentId).catch(() => {});
                    await refreshProfile();
                    toast.success(`Card payment verified! ${currentPlanObj.name} activated.`);
                    if (onSuccess) onSuccess();
                    if (onOpenChange) onOpenChange(false);
                  }}
                  onCancel={() => {
                    if (onOpenChange) onOpenChange(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
