import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Play,
  Pause,
  UserPlus,
  Music,
  Disc,
  Video,
  Share2,
  Check,
  Heart,
  DollarSign,
  Wallet,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Users
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useArtist, useArtistSongs, useArtistAlbums, useArtistVideos, useIsFollowing, useToggleFollowArtist } from '@/hooks'
import { usePlayer } from '@/contexts/PlayerContext'
import { useAuthStore } from '@/store/authStore'
import { getArtistRealStatistics } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatNumber } from '@/utils'
import { toast } from 'sonner'
import AdBanner from '@/components/ads/AdBanner'

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const artistId = id || ''
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const { data: artist, isLoading } = useArtist(artistId)
  const { data: songs } = useArtistSongs(artistId)
  const { data: albums } = useArtistAlbums(artistId)
  const { data: videos } = useArtistVideos(artistId)
  
  const artistUserId = artist?.user_id
  const { data: isFollowing = false, isLoading: checkingFollow } = useIsFollowing(artist?.id || artistId, artistUserId)
  const toggleFollow = useToggleFollowArtist()
  const { playSong, currentSong, playing } = usePlayer()
  const [copied, setCopied] = useState(false)

  // Real statistics from Supabase
  const { data: realStats, refetch: refetchStats } = useQuery({
    queryKey: ['artist_stats', artist?.id || id, artistUserId],
    queryFn: () => getArtistRealStatistics(artist?.id || id || '', artistUserId),
    enabled: !!artist,
  })

  // Listen to follow change events across windows/components
  useEffect(() => {
    const handleFollowChange = () => {
      refetchStats()
      queryClient.invalidateQueries({ queryKey: ['artist', id] })
    }
    window.addEventListener('zedvevo:artist-follow-changed', handleFollowChange)
    return () => {
      window.removeEventListener('zedvevo:artist-follow-changed', handleFollowChange)
    }
  }, [id, refetchStats, queryClient])

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="h-72 md:h-80 bg-gradient-to-b from-primary/20 via-background to-background" />
        <div className="container max-w-7xl px-4 py-8 mx-auto">
          <Skeleton className="w-48 h-10 mb-4" />
          <Skeleton className="w-32 h-6 mb-8" />
          <Skeleton className="w-full h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-foreground mb-2">Artist not found</h1>
        <p className="text-muted-foreground text-sm mb-6">The artist you are looking for does not exist or has been removed.</p>
        <Button asChild>
          <Link to="/artists">Browse All Artists</Link>
        </Button>
      </div>
    )
  }

  const displayName = artist.stage_name || artist.name || 'Artist'
  const avatarSrc = artist.avatar_url || artist.cover_url || artist.cover_image_url || artist.user?.avatar_url
  const coverSrc = artist.cover_url || artist.cover_image_url || avatarSrc

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${displayName} on ZedVevo`,
          text: `Check out ${displayName} on ZedVevo!`,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        toast.success('Artist link copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Ignored
    }
  }

  const handleToggleFollow = async () => {
    if (!user) {
      toast.info('Please sign in to follow this artist')
      return
    }
    try {
      const res = await toggleFollow.mutateAsync({
        artistId: artist.id,
        artistUserId: artist.user_id,
      })
      if (res.following) {
        toast.success(`Following ${displayName}!`)
      } else {
        toast.info(`Unfollowed ${displayName}`)
      }
      refetchStats()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update follow status')
    }
  }

  const handlePlaySong = (song: any) => {
    const fullSong = {
      id: song.id,
      title: song.title,
      artist_name: song.artist_name || displayName,
      file_url: song.file_url || song.audio_url || '',
      cover_url: song.cover_url || avatarSrc || '',
      play_count: song.play_count || 0,
      user_id: song.user_id || artist.user_id || '',
      created_at: song.created_at || '',
      like_count: song.like_count || 0,
      download_count: song.download_count || 0,
      share_count: song.share_count || 0,
    }
    playSong(fullSong as any)
  }

  const followerCount = realStats?.total_followers ?? artist.total_followers ?? 0
  const songPlays = songs && songs.length > 0 ? songs.reduce((sum, s) => sum + (Number(s.play_count) || 0), 0) : (Number(artist.play_count) || 0)
  const totalPlays = realStats?.total_plays ?? songPlays
  const totalLikes = realStats?.total_likes ?? 0

  return (
    <>
      <Helmet>
        <title>{displayName} — ZedVevo</title>
        <meta name="description" content={artist.bio || `Stream and download songs and watch official videos by ${displayName} on ZedVevo.`} />
        <meta property="og:site_name" content="ZedVevo" />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${displayName} — ZedVevo`} />
        <meta property="og:description" content={artist.bio || `Stream authentic Zambian music and watch official videos by ${displayName} on ZedVevo.`} />
        <meta property="og:image" content={avatarSrc || `${typeof window !== 'undefined' ? window.location.origin : ''}/og-image.png`} />
        <meta property="og:image:secure_url" content={avatarSrc || `${typeof window !== 'undefined' ? window.location.origin : ''}/og-image.png`} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${displayName} — ZedVevo`} />
        <meta name="twitter:description" content={artist.bio || `Listen to ${displayName} on ZedVevo`} />
        <meta name="twitter:image" content={avatarSrc || `${typeof window !== 'undefined' ? window.location.origin : ''}/og-image.png`} />
      </Helmet>

      <div className="min-h-screen pb-24">
        {/* Banner Header */}
        <div className="relative min-h-[300px] md:h-96 bg-gradient-to-b from-primary/30 via-background/80 to-background border-b border-border/40 flex items-end">
          {coverSrc && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-sm"
              style={{ backgroundImage: `url(${coverSrc})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

          <div className="container max-w-7xl px-4 relative z-10 pb-8 mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left"
            >
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-card shadow-2xl bg-muted shrink-0">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                    }}
                  />
                ) : (
                  <img
                    src="/app-icon.png"
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <h1 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight truncate">
                    {displayName}
                  </h1>
                  {artist.verified && (
                    <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                      ✓ Verified
                    </Badge>
                  )}
                </div>

                {artist.bio && (
                  <p className="text-muted-foreground text-sm max-w-2xl line-clamp-2 mb-3">
                    {artist.bio}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs md:text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {formatNumber(followerCount)} followers
                  </span>
                  <span>•</span>
                  <span>{formatNumber(totalPlays)} total plays</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    {formatNumber(totalLikes)} likes
                  </span>
                  {artist.genre && (
                    <>
                      <span>•</span>
                      <span className="text-primary font-medium uppercase tracking-wider">{artist.genre}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 shrink-0">
                {/* Working Follow / Following Button */}
                <Button
                  onClick={handleToggleFollow}
                  disabled={checkingFollow || toggleFollow.isPending}
                  variant={isFollowing ? 'secondary' : 'default'}
                  className={`gap-2 min-w-[110px] transition-all shadow-sm ${
                    isFollowing
                      ? 'bg-muted hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="h-4 w-4 text-primary" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Follow
                    </>
                  )}
                </Button>

                {songs && songs.length > 0 && (
                  <Button
                    onClick={() => handlePlaySong(songs[0])}
                    variant="outline"
                    className="gap-2 shadow-sm"
                  >
                    {currentSong?.id === songs[0].id && playing ? (
                      <>
                        <Pause className="h-4 w-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" /> Play Top Track
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={handleShare} title="Share Artist">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Real Ad Placement */}
        <div className="container max-w-7xl px-4 mx-auto pt-6">
          <AdBanner position="music" format="leaderboard" />
        </div>

        {/* Content Tabs */}
        <div className="container max-w-7xl px-4 py-8 mx-auto">
          <Tabs defaultValue="songs">
            <TabsList className="mb-8 bg-card border border-border flex-wrap">
              <TabsTrigger value="songs" className="gap-2">
                <Music className="h-4 w-4" />
                Songs ({songs?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-2">
                <Video className="h-4 w-4" />
                Videos ({videos?.length || 0})
              </TabsTrigger>
              {albums && albums.length > 0 && (
                <TabsTrigger value="albums" className="gap-2">
                  <Disc className="h-4 w-4" />
                  Albums ({albums.length})
                </TabsTrigger>
              )}
              <TabsTrigger value="revenue" className="gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue & Earnings
              </TabsTrigger>
            </TabsList>

            {/* SONGS TAB */}
            <TabsContent value="songs">
              {!songs || songs.length === 0 ? (
                <div className="text-center py-16 bg-card/40 rounded-2xl border border-dashed border-border p-8">
                  <Music className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-foreground font-medium">No songs uploaded yet by this artist</p>
                  <p className="text-muted-foreground text-xs mt-1">Check back later or explore other artists</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {songs.map((song: any, index: number) => {
                    const isCurrent = currentSong?.id === song.id
                    return (
                      <div
                        key={song.id}
                        onClick={() => handlePlaySong(song)}
                        className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-primary/10 border-primary/40 shadow-sm'
                            : 'bg-card border-border/60 hover:bg-card/80 hover:border-primary/30'
                        }`}
                      >
                        <span className="text-sm font-semibold text-muted-foreground w-6 text-center">
                          {index + 1}
                        </span>

                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                          {song.cover_url || avatarSrc ? (
                            <img
                              src={song.cover_url || avatarSrc}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Music className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isCurrent ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
                            {isCurrent && playing ? (
                              <Pause className="w-5 h-5 text-white" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-white" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-primary font-bold' : 'text-foreground'}`}>
                            {song.title}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.artist_name || displayName}
                          </p>
                        </div>

                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <span>{formatNumber(song.play_count || 0)} plays</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* VIDEOS TAB */}
            <TabsContent value="videos">
              {!videos || videos.length === 0 ? (
                <div className="text-center py-16 bg-card/40 rounded-2xl border border-dashed border-border p-8">
                  <Video className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-foreground font-medium">No videos uploaded yet by this artist</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videos.map((video: any) => (
                    <Link key={video.id} to={`/video/${video.id}`} className="group block">
                      <Card className="overflow-hidden border-border/60 group-hover:border-primary/40 transition-all bg-card">
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          {video.thumbnail_url || video.cover_url ? (
                            <img
                              src={video.thumbnail_url || video.cover_url}
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Video className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                              <Play className="h-5 w-5 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <h4 className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                            {video.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatNumber(video.views_count || video.view_count || 0)} views
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* REVENUE & EARNINGS TAB (Requirement 7 & 10) */}
            <TabsContent value="revenue">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Real Revenue & Monetization</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculated from verified Supabase transactions, verified plays, downloads, and platform monetization.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Total Earnings</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold text-foreground mt-2">
                      K{realStats ? realStats.total_earnings.toFixed(2) : '0.00'}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {realStats?.verified_transactions_count || 0} verified transactions
                    </p>
                  </Card>

                  <Card className="bg-card border-border/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Available Balance</span>
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold text-primary mt-2">
                      K{realStats ? realStats.available_balance.toFixed(2) : '0.00'}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Ready for withdrawal
                    </p>
                  </Card>

                  <Card className="bg-card border-border/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Pending Earnings</span>
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold text-amber-500 mt-2">
                      K{realStats ? realStats.pending_earnings.toFixed(2) : '0.00'}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Awaiting payment settlement
                    </p>
                  </Card>

                  <Card className="bg-card border-border/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Withdrawn Earnings</span>
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold text-foreground mt-2">
                      K{realStats ? realStats.withdrawn_earnings.toFixed(2) : '0.00'}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Successfully paid out
                    </p>
                  </Card>
                </div>

                {/* Stream Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <span className="text-xs text-muted-foreground">Song Streams</span>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {formatNumber(realStats?.song_plays || songPlays)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Monetized @ K0.05/play
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <span className="text-xs text-muted-foreground">Video Views</span>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {formatNumber(realStats?.video_plays || 0)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Monetized @ K0.05/view
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <span className="text-xs text-muted-foreground">Verified Transaction Records</span>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {realStats?.transactions?.length || 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Connected to Supabase payments
                    </p>
                  </div>
                </div>

                {/* Real Verified Transactions List */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="p-4 border-b border-border/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-sm text-foreground">Verified Payment & Royalty Ledger</h4>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      Supabase Realtime
                    </Badge>
                  </div>

                  {(!realStats?.transactions || realStats.transactions.length === 0) ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No external purchases or transactions recorded yet for this artist.
                      <p className="text-xs mt-1 text-muted-foreground/70">
                        Earnings from song and video streaming will accumulate as user plays increase.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {(realStats?.transactions || []).map((tx: any, idx: number) => (
                        <div key={tx.id || `tx-${idx}`} className="p-3.5 flex items-center justify-between text-sm hover:bg-muted/40 transition-colors">
                          <div>
                            <p className="font-medium text-foreground capitalize">
                              {tx.payment_type || 'Monetization Royalty'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Recent'} • Ref: {tx.transaction_id || (tx.id && typeof tx.id === 'string' ? tx.id.slice(0, 8) : 'N/A')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-emerald-500">
                              +K{Number(tx.amount || 0).toFixed(2)}
                            </span>
                            <Badge className="block text-[10px] mt-0.5 uppercase" variant={tx.status === 'successful' ? 'default' : 'outline'}>
                              {tx.status || 'completed'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
