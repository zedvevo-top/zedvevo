import { Link } from 'react-router-dom'
import { ARTIST_PLANS } from '@/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Sparkles, ShieldCheck, ArrowRight, Zap, Star, Crown, Globe } from 'lucide-react'
import { formatPrice } from '@/utils'
import { Helmet } from 'react-helmet-async'
import BackToHome from '@/components/common/BackToHome'

const planIcons: Record<string, any> = {
  daily: Zap,
  weekly: Star,
  annual: Crown,
  freshtunes: Globe,
}

const planBadges: Record<string, string> = {
  daily: 'Single Release',
  weekly: 'Most Popular 🔥',
  annual: 'Best Value 👑',
  freshtunes: 'Global DSPs 🌍',
}

export default function PlansPage() {
  return (
    <>
      <Helmet>
        <title>Artist Upload Plans & Pricing — ZedVevo</title>
        <meta name="description" content="Choose from ZedVevo artist plans. Upload songs, music videos, and distribute to Spotify and Apple Music with Lipila Mobile Money." />
      </Helmet>

      <div className="min-h-screen pt-20 pb-24 bg-background">
        <div className="container max-w-5xl px-4 mx-auto py-8">
          <BackToHome />

          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Zambian Artist Pricing & Instant Lipila Activation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
              Artist Upload Plans
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Distribute your music across Zambia and to worldwide streaming platforms. Pay seamlessly in Zambian Kwacha (ZMW) via Lipila Mobile Money.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(ARTIST_PLANS).map(([key, plan]) => {
              const Icon = planIcons[key] || Sparkles
              const isPopular = key === 'weekly'
              const badge = planBadges[key]

              return (
                <Card 
                  key={key}
                  className={`relative flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/80 border-border/80 ${
                    isPopular ? 'border-primary ring-2 ring-primary/30 shadow-lg' : ''
                  }`}
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider py-0.5 px-3 shadow-md">
                        {badge}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pt-8 pb-4">
                    <div className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${isPopular ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">{plan.name}</CardTitle>
                    <div className="mt-4 mb-2">
                      <span className="text-4xl font-black text-foreground">{formatPrice(plan.price)}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        /{key === 'daily' ? '1 song' : key === 'weekly' ? '7 days' : key === 'annual' ? '1 year' : 'one-time'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {key === 'daily' ? 'Active until single song or video is published' : key === 'weekly' ? 'Unlimited uploads + FreshTunes distribution' : key === 'annual' ? 'Unlimited uploads for 365 days + Verified Blue Badge' : 'Official FreshTunes portal access (No ZedVevo uploads)'}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-6 pb-8 flex-1 flex flex-col justify-between">
                    <ul className="space-y-2.5 text-left border-t border-border/50 pt-4 text-xs text-muted-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-foreground/90 font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button 
                      asChild 
                      className={`w-full font-bold h-10 gap-1.5 ${isPopular ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20' : ''}`}
                      variant={isPopular ? 'default' : 'outline'}
                    >
                      <Link to={`/renew-plan?plan=${key}`}>
                        <span>Select Plan</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="mt-12 text-center text-xs text-muted-foreground max-w-lg mx-auto">
            <p className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Payments processed securely by Lipila Mobile Money (MTN, Airtel, Zamtel) & Card. Instant automatic entitlement upon confirmation.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
