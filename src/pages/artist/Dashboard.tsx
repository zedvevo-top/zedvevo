import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { useAuth } from '@/contexts/AuthContext'
import { ARTIST_NAV } from '@/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Music, Upload, BarChart2, DollarSign, Users, Play, TrendingUp, 
  CreditCard, Globe, RefreshCw, CheckCircle2, Clock, Sparkles 
} from 'lucide-react'
import { formatNumber, formatDate, formatCurrency } from '@/utils'
import { getUserActiveSubscription, getUserSubscriptions } from '@/lib/api'
import { supabase } from '@/db/supabase'
import FreshTunesPortalModal from '@/components/distribution/FreshTunesPortalModal'

export default function ArtistDashboard() {
  const { user, artist } = useAuthStore()
  const { profile } = useAuth()
  const [subscription, setSubscription] = useState<any>(null)
  const [hasFreshtunes, setHasFreshtunes] = useState(false)
  const [showFreshtunesModal, setShowFreshtunesModal] = useState(false)
  const [loadingSub, setLoadingSub] = useState(true)

  useEffect(() => {
    if (!user) return
    async function loadSubData() {
      try {
        const [sub, allSubs] = await Promise.all([
          getUserActiveSubscription(user.id),
          getUserSubscriptions(user.id)
        ])
        // If no active subscription is found, check if there's any expired one
        setSubscription(sub || (allSubs.length > 0 ? allSubs[0] : null))

        const { data: payData } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['successful', 'completed', 'SUCCESSFUL', 'COMPLETED'])
          .or('amount.eq.120,metadata->>plan_type.eq.k120_freshtunes')
          .maybeSingle()

        if (payData) {
          setHasFreshtunes(true)
        }
      } catch (err) {
        console.warn('Load artist dashboard data error:', err)
      } finally {
        setLoadingSub(false)
      }
    }
    loadSubData()
  }, [user])

  const stats = [
    { label: 'Total Streams', value: formatNumber(artist?.total_streams || 0), icon: Play },
    { label: 'Followers', value: formatNumber(artist?.total_followers || 0), icon: Users },
    { label: 'Monthly Listeners', value: formatNumber(artist?.monthly_listeners || 0), icon: TrendingUp },
    { label: 'Revenue', value: 'ZMW 0', icon: DollarSign },
  ]

  const isSubscriptionActive = (sub: any) => {
    if (!sub) return false;
    const status = sub.status?.toLowerCase();
    return status === 'active' && 
           sub.is_active === true &&
           !sub.consumed &&
           (!sub.expires_at || new Date(sub.expires_at) > new Date());
  };

  const isActive = isSubscriptionActive(subscription);

  return (
    <div className="min-h-screen bg-background">
      <FreshTunesPortalModal
        open={showFreshtunesModal}
        onOpenChange={setShowFreshtunesModal}
      />

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 border-r border-border bg-card min-h-[calc(100vh-4rem)]">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Artist Dashboard</h2>
            <nav className="space-y-1">
              {ARTIST_NAV.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-mid-gray transition-colors"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {artist?.stage_name || user?.full_name || profile?.display_name || 'Artist'}</h1>
            <p className="text-gray-400">Manage your music releases, subscriptions, and distribution</p>
          </div>

          {/* Subscription Management Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* ZedVevo Upload Subscription Card */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span>{isActive ? 'Artist Upload Subscription' : 'Artist Plan Action Required'}</span>
                  </CardTitle>
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold ${isActive ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40' : 'bg-destructive/15 text-destructive border-destructive/30'}`}>
                    {isActive ? 'ACTIVE' : 'EXPIRED / INACTIVE'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                {loadingSub ? (
                  <p className="text-muted-foreground">Loading subscription details...</p>
                ) : subscription ? (
                  <>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Current Plan:</span>
                      <strong className="text-foreground font-semibold">{subscription.upload_plans?.name || subscription.plan_type}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Payment Amount:</span>
                      <strong className="text-foreground font-mono">{formatCurrency(subscription.upload_plans?.price || 10)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`font-bold ${isActive ? 'text-emerald-500' : 'text-destructive'}`}>
                        {subscription.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Expiration Date:</span>
                      <span className="text-foreground">{subscription.expires_at ? formatDate(subscription.expires_at) : 'Single Use'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Quota Remaining:</span>
                      <span className="text-foreground font-mono">
                        {subscription.uploads_allowed === null ? 'Unlimited' : `${Math.max(0, (subscription.uploads_allowed - (subscription.uploads_used || 0)))} remaining`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-2 text-muted-foreground italic">
                    No upload plan history detected.
                  </div>
                )}

                <div className="pt-2">
                  <Button asChild size="sm" className={`w-full gap-1.5 font-bold text-xs ${isActive ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-destructive hover:bg-destructive/90 text-white shadow-md'}`}>
                    <Link to="/renew-plan">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{isActive ? 'Change or Upgrade Plan' : 'Renew / Purchase Upload Plan'}</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* FreshTunes Distribution Access Card (K120) */}
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-3 border-b border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    <span>FRESHTUNES DISTRIBUTION ACCESS</span>
                  </CardTitle>
                  <Badge className="bg-emerald-500 text-white text-[10px] uppercase font-extrabold border-0">
                    {hasFreshtunes ? 'PAID / ACTIVE' : 'ONE-TIME K120'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-emerald-500/20">
                  <span className="text-muted-foreground">Payment Amount:</span>
                  <strong className="text-foreground font-mono">ZMW 120.00 (One-Time)</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-500/20">
                  <span className="text-muted-foreground">Access Type:</span>
                  <span className="text-foreground font-medium">Integrated Global DSPs Portal (Spotify, Apple Music, Amazon)</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Distribute your music worldwide to streaming platforms with 100% royalties kept. (Note: Separate from ZedVevo song/video uploads).
                </p>

                <div className="pt-2">
                  {hasFreshtunes ? (
                    <Button 
                      type="button" 
                      onClick={() => setShowFreshtunesModal(true)}
                      className="w-full gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>OPEN FRESHTUNES</span>
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="w-full gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Link to="/renew-plan?plan=freshtunes">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Purchase FreshTunes Access (K120)</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Link to="/artist/upload">
              <Card className="cursor-pointer hover:bg-mid-gray transition-colors">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-electric/20 rounded-lg">
                    <Upload className="h-6 w-6 text-electric" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Upload Song</h3>
                    <p className="text-sm text-gray-400">Share new music</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/artist/upload-video">
              <Card className="cursor-pointer hover:bg-mid-gray transition-colors">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-electric/20 rounded-lg">
                    <Music className="h-6 w-6 text-electric" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Upload Video</h3>
                    <p className="text-sm text-gray-400">Add music videos</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/artist/events">
              <Card className="cursor-pointer hover:bg-mid-gray transition-colors">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-electric/20 rounded-lg">
                    <BarChart2 className="h-6 w-6 text-electric" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Create Event</h3>
                    <p className="text-sm text-gray-400">Sell tickets</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <stat.icon className="h-5 w-5 text-electric" />
                    <span className="text-gray-400 text-sm">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-400">
                No recent activity. Upload your first song to get started!
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
