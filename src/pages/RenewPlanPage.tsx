import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Zap, Star, Crown, Check, AlertCircle, Phone, Loader2, 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles, CreditCard,
  Music2, Globe, Clock, RefreshCw, AlertTriangle
} from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthStore } from '@/store/authStore'
import { lipilaService, detectNetwork } from '@/services/lipila'
import { supabase } from '@/lib/supabase'
import { getUserActiveSubscription, checkUploadEntitlement } from '@/lib/api'
import { ARTIST_PLANS } from '@/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import BackToHome from '@/components/common/BackToHome'

type PlanType = 'daily' | 'weekly' | 'annual' | 'freshtunes'

export default function RenewPlanPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preselectedPlan = searchParams.get('plan') as PlanType | null
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(preselectedPlan || 'weekly')
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [activeSub, setActiveSub] = useState<any>(null)
  const [checkingSub, setCheckingSub] = useState(true)

  // Verify current subscription status
  const checkCurrentStatus = useCallback(async () => {
    if (!user) {
      setCheckingSub(false)
      return
    }

    try {
      const entitlement = await checkUploadEntitlement(user.id)
      if (entitlement.entitled) {
        setActiveSub(entitlement.subscription)
      } else {
        setActiveSub(null)
      }
    } catch (err) {
      console.warn('Error checking entitlement:', err)
      setActiveSub(null)
    } finally {
      setCheckingSub(false)
    }
  }, [user])

  useEffect(() => {
    checkCurrentStatus()

    if (!user) return

    // Set phone number default from profile if available
    const profPhone = profile?.phone || (user as any)?.phone || ''
    if (profPhone && !phoneNumber) {
      setPhoneNumber(profPhone)
    }

    // Realtime listeners: whenever payments or subscriptions change for this user, refresh immediately!
    const subChannel = supabase
      .channel(`renew_sub_${user.id}_${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
        () => {
          checkCurrentStatus()
          handlePlanActivated()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const newStatus = payload.new?.status
          if (newStatus === 'completed' || newStatus === 'successful') {
            handlePlanActivated()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.upload_access === 'active') {
            handlePlanActivated()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subChannel)
    }
  }, [user, profile, checkCurrentStatus])

  const handlePlanActivated = () => {
    setPaymentStatus('success')
    setStatusMessage('Payment confirmed! Your artist plan is now active.')
    toast.success('🎉 Your artist plan has been activated! You can now upload songs and videos.')
    useAuthStore.getState().fetchUser()
    useAuthStore.getState().fetchArtist()

    setTimeout(() => {
      setPaymentModalOpen(false)
      navigate('/upload')
    }, 2000)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.startsWith('0')) {
      value = '260' + value.substring(1)
    }
    setPhoneNumber(value)
  }

  const detectedNetwork = phoneNumber ? detectNetwork(phoneNumber) : null

  // Initiate Lipila payment
  const handleInitiatePayment = async () => {
    if (!user) {
      toast.error('Please sign in or register to renew your plan')
      navigate('/login?redirect=/renew-plan')
      return
    }

    if (!selectedPlan) {
      toast.error('Please select an upload plan')
      return
    }

    const plan = ARTIST_PLANS[selectedPlan]
    if (!plan) return

    if (paymentMethod === 'mobile_money') {
      if (!phoneNumber || phoneNumber.length < 9) {
        toast.error('Please enter a valid Zambian phone number')
        return
      }

      if (!detectedNetwork) {
        toast.error('Invalid network. Please use an MTN (076, 096, 095, 097) or Airtel (077, 078, 079) number.')
        return
      }
    }

    setIsProcessing(true)
    setPaymentStatus('pending')
    setStatusMessage(`Initiating ${detectedNetwork ? detectedNetwork.toUpperCase() : 'Lipila'} payment for ZMW ${plan.price}...`)
    setPaymentModalOpen(true)

    try {
      const result = await lipilaService.subscribeArtist(selectedPlan, plan.price, phoneNumber || '260970000000', user.id)

      if (!result.success) {
        setPaymentStatus('failed')
        setStatusMessage(result.error || 'Payment request failed. Please check your phone number and try again.')
        setIsProcessing(false)
        return
      }

      const pId = result.paymentId || null
      setPaymentId(pId)

      if (result.status === 'completed') {
        handlePlanActivated()
      } else {
        setStatusMessage('Payment request dispatched! Please check your mobile phone and enter your Mobile Money PIN to authorize the payment.')
        toast.info('Please approve the PIN prompt on your phone')

        if (pId) {
          startPolling(pId)
        }
      }
    } catch (err: any) {
      setPaymentStatus('failed')
      setStatusMessage(err.message || 'Payment initiation failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Poll Lipila verification
  const startPolling = (pId: string) => {
    let attempts = 0
    const maxAttempts = 40 // 40 * 2.5s = 100 seconds

    const interval = setInterval(async () => {
      attempts++
      if (attempts >= maxAttempts) {
        clearInterval(interval)
        if (paymentStatus === 'pending') {
          setStatusMessage('We are still awaiting confirmation from your mobile network. If you have entered your PIN or an Admin approves, your plan will activate automatically.')
        }
        return
      }

      try {
        const verifyRes = await lipilaService.checkPaymentStatus(pId)
        if (verifyRes.status === 'completed' || verifyRes.success) {
          clearInterval(interval)
          handlePlanActivated()
        } else if (verifyRes.status === 'failed') {
          clearInterval(interval)
          setPaymentStatus('failed')
          setStatusMessage(verifyRes.error || 'Payment was declined or failed on your device.')
        }
      } catch (e) {
        // Continue polling
      }
    }, 2500)
  }

  const plans = [
    {
      id: 'daily' as PlanType,
      name: 'Single Track Pass',
      badge: 'Single Release',
      price: 10,
      period: '1 Song or Video',
      icon: Zap,
      description: 'Perfect for artists dropping a new single or music video on ZedVevo.',
      features: [
        '1 Song (MP3) or Video (MP4) Upload',
        'Instant Live Streaming on ZedVevo',
        'Zambian Play Count & Streaming Stats',
        'Social Sharing & Direct Download Link',
        'Valid until your song is published',
      ],
      color: 'border-border',
      highlight: false,
    },
    {
      id: 'weekly' as PlanType,
      name: 'Weekly Creator Pass',
      badge: 'Most Popular 🔥',
      price: 100,
      period: '7 Days Unlimited',
      icon: Star,
      description: 'Ideal for prolific creators and musicians releasing multiple tracks or an EP.',
      features: [
        'Unlimited Song & Video Uploads for 7 Days',
        'FreshTunes Multi-Platform Distribution (Spotify, Apple Music, Boomplay, Amazon)',
        'Priority Content Review (Under 2 hours)',
        'Detailed Listener Demographics & Analytics',
        'Direct Download Link & Promo Artwork',
      ],
      color: 'border-primary/60 bg-primary/5',
      highlight: true,
    },
    {
      id: 'annual' as PlanType,
      name: 'Annual Pro VIP Pass',
      badge: 'Best Value 👑',
      price: 300,
      period: '365 Days (1 Full Year)',
      icon: Crown,
      description: 'For serious professional recording artists building a long-term music career.',
      features: [
        'Unlimited Uploads for 1 Full Year (365 Days)',
        'All Streaming Platforms via FreshTunes VIP (100% Royalties Kept)',
        'Official Blue Verified Artist Badge',
        'Eligible for ZedVevo Music Awards & Nominee Spotlight',
        'Homepage Featured Banner Placement',
        'Dedicated VIP Artist Support',
      ],
      color: 'border-amber-500/60 bg-amber-500/5',
      highlight: false,
    },
    {
      id: 'freshtunes' as PlanType,
      name: 'FreshTunes Distribution Access',
      badge: 'Global DSPs 🌍',
      price: 120,
      period: 'One-Time Purchase',
      icon: Globe,
      description: 'Integrated FreshTunes distribution portal access. (Note: Does not unlock ZedVevo song/video uploads).',
      features: [
        'Integrated FreshTunes Portal Access inside ZedVevo',
        'Distribute to Spotify, Apple Music, YouTube Music & Amazon',
        'Keep 100% Royalties Kept',
        'One-Time Purchase (No Recurring Charges)',
      ],
      color: 'border-emerald-500/60 bg-emerald-500/5',
      highlight: false,
    },
  ]

  return (
    <>
      <Helmet>
        <title>Renew Artist Upload Plan — ZedVevo</title>
        <meta name="description" content="Renew your artist upload plan with Lipila Mobile Money to upload new Zambian songs, albums, and videos." />
      </Helmet>

      <div className="min-h-screen pt-20 pb-24 bg-background">
        <div className="container max-w-5xl px-4 mx-auto py-6">
          <BackToHome />

          {/* Expiration Notice Banner */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
              <RefreshCw className="w-4 h-4" />
              <span>Artist Subscription Renewal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Renew Your Artist Upload Plan
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm sm:text-base max-w-2xl">
              Choose from our flexible artist plans to reactivate upload access. Once Lipila confirms your payment or an Admin approves, your upload access unlocks immediately.
            </p>

            {/* Current Status Box */}
            <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {activeSub ? 'Active Plan Detected' : 'Upload Plan Status: Expired / Inactive'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeSub
                      ? `You currently hold an active ${activeSub.upload_plans?.name || 'plan'}. Renewing will extend your validity or add upload quota.`
                      : 'Your previous single upload token has been consumed or your subscription period has ended. Select a plan below to renew.'}
                  </p>
                </div>
              </div>

              {activeSub && (
                <Button asChild size="sm" className="bg-primary shrink-0 text-xs">
                  <Link to="/upload">
                    <span>Go to Upload Form</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Plan Tiers Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {plans.map((plan) => {
              const Icon = plan.icon
              const isSelected = selectedPlan === plan.id

              return (
                <Card
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/40 shadow-xl bg-card -translate-y-1'
                      : `${plan.color} hover:border-primary/40 bg-card/60 hover:bg-card`
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider py-0.5 px-2.5 shadow-md">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pt-6 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <CardTitle className="text-lg font-bold text-foreground">{plan.name}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground min-h-[32px] mt-1">
                      {plan.description}
                    </CardDescription>

                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-foreground">ZMW {plan.price}</span>
                        <span className="text-xs text-muted-foreground">/{plan.period}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pb-6 flex-1 flex flex-col justify-between">
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-foreground/90">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      className={`w-full font-bold text-xs h-9 ${isSelected ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}
                    >
                      {isSelected ? 'Selected Plan' : `Select for ZMW ${plan.price}`}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Payment Checkout Panel */}
          <Card className="border border-border/80 bg-card/80 backdrop-blur shadow-xl">
            <CardHeader className="border-b border-border/50 py-4 px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <span>Instant Lipila Payment & Auto-Activation</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Selected Plan: <strong className="text-foreground">{ARTIST_PLANS[selectedPlan]?.name}</strong> · Total: <strong className="text-emerald-500 text-sm">ZMW {ARTIST_PLANS[selectedPlan]?.price}.00</strong>
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider w-fit">
                  Instant Activation
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* Payment Method Tabs */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-2 block">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      paymentMethod === 'mobile_money'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-card/50 text-muted-foreground hover:bg-card'
                    }`}
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <p className="font-bold">Mobile Money</p>
                      <p className="text-[10px] text-muted-foreground">MTN · Airtel · Zamtel</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      paymentMethod === 'card'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-card/50 text-muted-foreground hover:bg-card'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <p className="font-bold">Card Payment</p>
                      <p className="text-[10px] text-muted-foreground">Visa · Mastercard</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Mobile Money Phone Input */}
              {paymentMethod === 'mobile_money' && (
                <div className="space-y-2 max-w-md">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Zambian Mobile Money Number:
                    </label>
                    {detectedNetwork && (
                      <Badge className="text-[10px] uppercase font-bold bg-primary/20 text-primary border-primary/30">
                        {detectedNetwork.toUpperCase()} Detected
                      </Badge>
                    )}
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="tel"
                      placeholder="e.g. 097xxxxxxx or 076xxxxxxx"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className="pl-10 h-11 text-sm bg-card border-border/80 focus:border-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Accepts MTN (097, 076, 095, 096) and Airtel (077, 078, 079). You will receive an on-screen USSD prompt to authorize the transaction.
                  </p>
                </div>
              )}

              {/* Action Button & Guarantee */}
              <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    Instant Upgrade: ZMW {ARTIST_PLANS[selectedPlan]?.price}.00
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Once Lipila confirms payment or an Admin approves, your upload access is immediately unlocked.
                  </p>
                </div>

                <Button
                  onClick={handleInitiatePayment}
                  disabled={isProcessing}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2 shrink-0 h-11 px-6"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting Lipila...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ZMW {ARTIST_PLANS[selectedPlan]?.price} with Lipila</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Live Lipila Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Lipila Payment Confirmation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Plan: {ARTIST_PLANS[selectedPlan]?.name} · Amount: ZMW {ARTIST_PLANS[selectedPlan]?.price}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 text-center space-y-4">
            {paymentStatus === 'pending' && (
              <div className="space-y-4">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping opacity-30" />
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="font-bold text-foreground text-sm">
                    Waiting for Mobile Money Approval
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {statusMessage || 'Please check your phone screen for the Mobile Money PIN prompt and confirm the payment.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-left text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Number:</span>
                    <strong className="text-foreground">{phoneNumber}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount:</span>
                    <strong className="text-emerald-500 font-bold">ZMW {ARTIST_PLANS[selectedPlan]?.price}.00</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Status:</span>
                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-pulse" /> Awaiting PIN
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/80 italic">
                  💡 Keep this window open. Once Lipila confirms your payment or an Admin approves, your upload access will activate automatically!
                </p>
              </div>
            )}

            {paymentStatus === 'success' && (
              <div className="space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-foreground text-base">
                    Plan Activated Successfully! 🎉
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {statusMessage || 'Your payment has been verified. Redirecting you to the upload page...'}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setPaymentModalOpen(false)
                    navigate('/upload')
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10"
                >
                  Proceed to Upload Songs Now
                </Button>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-destructive/20 text-destructive flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-foreground text-sm">
                    Payment Not Completed
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {statusMessage || 'The payment transaction could not be verified or was cancelled.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPaymentModalOpen(false)}
                    className="flex-1 text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handleInitiatePayment}
                    className="flex-1 bg-primary text-xs font-bold"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
