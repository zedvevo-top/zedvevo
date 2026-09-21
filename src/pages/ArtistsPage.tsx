import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Search, Users, Sparkles } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useArtists } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/ui/avatar'
import { formatNumber } from '@/utils'

export default function ArtistsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: artists, isLoading } = useArtists(60)

  const filteredArtists = artists?.filter((artist) => {
    const name = (artist.stage_name || artist.name || '').toLowerCase()
    const bio = (artist.bio || '').toLowerCase()
    const genre = (artist.genre || '').toLowerCase()
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return name.includes(query) || bio.includes(query) || genre.includes(query)
  })

  return (
    <>
      <Helmet>
        <title>Artists & Musicians — ZedVevo</title>
        <meta name="description" content="Discover, follow, and stream music and videos from top Zambian artists on ZedVevo." />
      </Helmet>
      <div className="min-h-screen pb-20">
        <div className="bg-gradient-to-b from-primary/10 via-background to-background py-10 md:py-14 border-b border-border/40">
          <div className="container max-w-7xl px-4 mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  Zambian Artists
                </h1>
                <p className="text-muted-foreground mt-2 text-sm md:text-base">
                  Explore verified artists, producers, and creators shaping the sound of Zambia.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/become-artist">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Become an Artist
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-7xl px-4 mx-auto py-8">
          <div className="mb-8 max-w-md relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search artists by name, genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card/60 border-border"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
            {isLoading ? (
              Array(12).fill(0).map((_, i) => (
                <div key={i} className="p-4 border rounded-xl bg-card space-y-3">
                  <Skeleton className="w-24 h-24 rounded-full mx-auto" />
                  <Skeleton className="w-20 h-4 mx-auto" />
                  <Skeleton className="w-16 h-3 mx-auto" />
                </div>
              ))
            ) : filteredArtists?.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-card/40 rounded-2xl border border-dashed border-border p-8">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-foreground mb-1">No artists found</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {searchQuery ? `No artists match "${searchQuery}". Try a different keyword.` : 'Check back soon for new artists joining ZedVevo.'}
                </p>
              </div>
            ) : (
              filteredArtists?.map((artist, index) => {
                const displayName = artist.stage_name || artist.name || 'Artist'
                const avatarSrc = artist.avatar_url || artist.cover_url || artist.cover_image_url || artist.user?.avatar_url
                return (
                  <motion.div
                    key={artist.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.4) }}
                  >
                    <Link to={`/artist/${artist.id}`} className="block group">
                      <Card className="overflow-hidden text-center transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg group-hover:-translate-y-1 bg-card border-border/60">
                        <CardContent className="p-4">
                          <div className="relative mx-auto mb-3 w-24 h-24 md:w-28 md:h-28">
                            <div className="w-full h-full rounded-full overflow-hidden border-2 border-border/80 group-hover:border-primary transition-colors bg-muted">
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt={displayName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    // Fallback to initial
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/60 bg-muted">
                                  {displayName[0]?.toUpperCase() || 'A'}
                                </div>
                              )}
                            </div>
                            {artist.verified && (
                              <Badge
                                className="absolute bottom-0 right-0 h-6 w-6 p-0 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-md text-xs"
                                title="Verified Artist"
                              >
                                ✓
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-foreground truncate text-sm md:text-base group-hover:text-primary transition-colors">
                            {displayName}
                          </h3>
                          {artist.genre && (
                            <p className="text-[11px] text-muted-foreground truncate uppercase tracking-wider mt-0.5">
                              {artist.genre}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatNumber(artist.play_count || artist.monthly_listeners || 0)} plays
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
