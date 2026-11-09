import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Globe, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { UploadPlan, UserSubscription, PaymentStatus } from '@/types/index';
import { getActivePlans, getUserActiveSubscription, applyPaymentBenefits } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { formatCurrency } from '@/lib/utils';
import { processUnifiedPayment, listenForPaymentStatus } from '@/lib/paymentProcessor';
import { toast } from 'sonner';
import CardPaymentForm from '@/components/payment/CardPaymentForm';
import PlanRenewalDialog from '@/components/common/PlanRenewalDialog';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  onPlanRenewed?: () => void;
}

export default function SubscriptionGuard({ children, onPlanRenewed }: SubscriptionGuardProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<UploadPlan[]>([]);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  
  // Payment dialog state
  const [payDialog, setPayDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<UploadPlan | null>(null);
  const [payMethod, setPayMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [phone, setPhone] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
      if (isAdmin) {
        setLoading(false);
        return;
      }

      const [activeSub, activePlans] = await Promise.all([
        getUserActiveSubscription(user.id),
        getActivePlans()
      ]);

      setSubscription(activeSub);
      setPlans(activePlans);

      const hasValidSub = !!activeSub && activeSub.is_active && !activeSub.consumed && (activeSub.uploads_allowed === null || (activeSub.uploads_used || 0) < activeSub.uploads_allowed);
      const hasUploadAccess = profile?.upload_access === 'active' || (profile?.is_artist && profile?.upload_access !== 'inactive');

      if (!hasValidSub && !hasUploadAccess) {
        setShowRenewalModal(true);
      } else {
        setShowRenewalModal(false);
      }
    } catch (err) {
      console.warn('SubscriptionGuard check error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    void checkSubscription();

    if (!user) return;
    const channel = supabase
      .channel(`sub_guard_${user.id}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
        () => { void checkSubscription(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, checkSubscription]);

  const handleOpenPayment = (plan: UploadPlan) => {
    setSelectedPlan(plan);
    setPayMethod('mobile_money');
    setPhone('');
    setPaymentStatus(null);
    setPayDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedPlan || !user) return;
    if (payMethod === 'mobile_money' && !phone) {
      toast.error('Please enter your mobile money phone number');
      return;
    }

    setPayLoading(true);
    try {
      const result = await processUnifiedPayment({
        amount: selectedPlan.price,
        payment_method: payMethod,
        phone_number: payMethod === 'mobile_money' ? phone : undefined,
        description: `ZedVevo ${selectedPlan.name} Upload Plan`,
        payment_type: 'plan',
        plan_id: selectedPlan.id,
        user_id: user.id,
        metadata: { user_id: user.id, plan_type: selectedPlan.plan_type, plan_id: selectedPlan.id }
      });

      if (!result.success) {
        setPaymentStatus('failed');
        toast.error(result.error || 'Payment failed.');
        setPayLoading(false);
        return;
      }

      if (result.status === 'completed' || result.status === 'successful') {
        setPaymentStatus('completed');
        if (result.payment_id) {
          await applyPaymentBenefits(result.payment_id).catch(() => {});
        }
        await checkSubscription();
        setPayDialog(false);
        setShowRenewalModal(false);
        setPayLoading(false);
        toast.success('Payment approved! Upload access is now active.');
        if (onPlanRenewed) onPlanRenewed();
        return;
      }

      setPaymentStatus('pending');
      toast.info('Mobile Money prompt sent to your phone! Enter your PIN on your phone to confirm.');

      listenForPaymentStatus(result.payment_id!, async (statusRes) => {
        if (statusRes.status === 'completed' || statusRes.status === 'successful') {
          setPaymentStatus('completed');
          if (result.payment_id) {
            await applyPaymentBenefits(result.payment_id).catch(() => {});
          }
          await checkSubscription();
          setPayDialog(false);
          setShowRenewalModal(false);
          toast.success('Lipila confirmed payment! Upload access is now active.');
          if (onPlanRenewed) onPlanRenewed();
        } else if (statusRes.status === 'failed') {
          setPaymentStatus('failed');
          toast.error(statusRes.failure_reason || 'Payment failed or was declined.');
        }
        setPayLoading(false);
      });
    } catch (err: any) {
      toast.error(err?.message || 'Payment processing failed');
      setPaymentStatus('failed');
      setPayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const hasValidSub = !!subscription && 
                      subscription.is_active && 
                      !subscription.consumed && 
                      subscription.status !== 'expired' && 
                      subscription.status !== 'inactive' && 
                      (subscription.expires_at == null || new Date(subscription.expires_at) > new Date()) && 
                      (subscription.uploads_allowed === null || (subscription.uploads_used || 0) < subscription.uploads_allowed);

  if (!isAdmin && !hasValidSub) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <PlanRenewalDialog
          open={true}
          onOpenChange={(val) => {
            if (!val) {
              navigate('/');
            }
          }}
          onSuccess={() => {
            void checkSubscription();
            if (onPlanRenewed) onPlanRenewed();
          }}
          subscription={subscription}
        />

        <div className="p-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-foreground space-y-4 mb-8 text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 text-xs font-bold uppercase tracking-wider mb-2">
            Status: Expired / Locked
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
            Artist Upload Plan Expired or Limit Reached
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Your active upload subscription has expired or your single-song upload token has been consumed. Select a plan below (K10 single release or K100 unlimited) to renew and unlock instant uploading.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isSingle = plan.plan_type === 'k10_single' || plan.price <= 15;
            const isWeekly = plan.plan_type === 'k100_weekly' || (plan.price >= 80 && plan.price <= 150);
            const isAnnual = plan.plan_type === 'k300_yearly' || plan.price >= 250;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between border-border/80 hover:border-primary/60 bg-card shadow-md transition-all ${
                  isWeekly ? 'border-primary/50 ring-2 ring-primary/20' : ''
                }`}
              >
                <CardHeader className="p-5 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isSingle ? 'Single Release' : isWeekly ? 'Creator Pass' : 'Pro VIP'}
                    </span>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      {isSingle ? '1 Upload' : isWeekly ? '7 Days' : '1 Year'}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  <div className="pt-3">
                    <span className="text-3xl font-black text-foreground">{formatCurrency(plan.price)}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-2 space-y-4">
                  <ul className="space-y-2 text-xs text-muted-foreground border-t border-border/40 pt-3">
                    <li className="flex items-center gap-2 text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{isSingle ? '1 Song or Video upload' : 'Unlimited uploads'}</span>
                    </li>
                    <li className="flex items-center gap-2 text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Instant Live Publishing</span>
                    </li>
                    {isWeekly && (
                      <li className="flex items-center gap-2 text-emerald-500 font-medium">
                        <Globe className="w-4 h-4 shrink-0" />
                        <span>FreshTunes Distribution</span>
                      </li>
                    )}
                  </ul>

                  <Button
                    type="button"
                    onClick={() => handleOpenPayment(plan)}
                    className="w-full font-bold text-sm h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow"
                  >
                    Select & Pay {formatCurrency(plan.price)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Plan Renewal Payment Dialog */}
        <Dialog open={payDialog} onOpenChange={setPayDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Payment for {selectedPlan?.name}</DialogTitle>
              <DialogDescription>
                Pay {selectedPlan && formatCurrency(selectedPlan.price)} securely via Lipila Mobile Money or Card.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={payMethod === 'mobile_money' ? 'default' : 'outline'}
                  onClick={() => setPayMethod('mobile_money')}
                  className="text-xs"
                >
                  Mobile Money
                </Button>
                <Button
                  type="button"
                  variant={payMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPayMethod('card')}
                  className="text-xs"
                >
                  Credit / Debit Card
                </Button>
              </div>

              {payMethod === 'mobile_money' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Mobile Money Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0971234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={payLoading}
                    onClick={() => void handlePayment()}
                    className="w-full bg-primary text-primary-foreground font-bold"
                  >
                    {payLoading && paymentStatus === 'pending' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming on Phone...
                      </>
                    ) : (
                      `Pay ${selectedPlan ? formatCurrency(selectedPlan.price) : ''}`
                    )}
                  </Button>
                </div>
              ) : (
                <CardPaymentForm
                  amount={selectedPlan?.price || 0}
                  currency="ZMW"
                  description={`ZedVevo ${selectedPlan?.name}`}
                  onSuccess={async (paymentId) => {
                    await applyPaymentBenefits(paymentId).catch(() => {});
                    await checkSubscription();
                    setPayDialog(false);
                    setShowRenewalModal(false);
                    toast.success('Card payment successful! Upload access unlocked.');
                    if (onPlanRenewed) onPlanRenewed();
                  }}
                  onError={(err) => toast.error(err)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return <>{children}</>;
}
