import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Play, Pause, UserPlus, Music, Disc, Video, Share2, Check } from 'lucide-react'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useArtist, useArtistSongs, useArtistAlbums, useArtistVideos, useFollowArtist, useUnfollowArtist } from '@/hooks'
import { usePlayer } from '@/contexts/PlayerContext'
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
  const { data: artist, isLoading } = useArtist(id!)
  const { data: songs } = useArtistSongs(id!)
  const { data: albums } = useArtistAlbums(id!)
  const { data: videos } = useArtistVideos(id!)
  const followArtist = useFollowArtist()
  const unfollowArtist = useUnfollowArtist()
  const { playSong, currentSong, playing, togglePlay } = usePlayer()
  const [copied, setCopied] = useState(false)

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

  const handlePlaySong = (song: any) => {
    // Adapt to Song format expected by PlayerContext
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
        <div className="relative h-72 md:h-96 bg-gradient-to-b from-primary/30 via-background/80 to-background border-b border-border/40">
          {coverSrc && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-sm"
              style={{ backgroundImage: `url(${coverSrc})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

          <div className="container max-w-7xl px-4 absolute bottom-0 left-0 right-0 pb-8 mx-auto">
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
                  <span>{formatNumber(artist.total_followers || 0)} followers</span>
                  <span>•</span>
                  <span>
                    {formatNumber(
                      (songs && songs.length > 0)
                        ? songs.reduce((sum, s) => sum + (Number(s.play_count) || 0), 0)
                        : (Number(artist.play_count) || 0)
                    )} total plays
                  </span>
                  {artist.genre && (
                    <>
                      <span>•</span>
                      <span className="text-primary font-medium uppercase tracking-wider">{artist.genre}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {songs && songs.length > 0 && (
                  <Button
                    onClick={() => handlePlaySong(songs[0])}
                    className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {currentSong?.id === songs[0].id && playing ? (
                      <>
                        <Pause className="h-4 w-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" /> Play All
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
            <TabsList className="mb-8 bg-card border border-border">
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
            </TabsList>

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
          </Tabs>
        </div>
      </div>
    </>
  )
}
