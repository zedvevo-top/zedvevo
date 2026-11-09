import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Search, Plus, Edit2, Trash2, CheckCircle2, XCircle,
  Eye, TrendingUp, Music, Video, DollarSign, Wallet, ShieldCheck,
  RefreshCw, Loader2, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  getAllArtists, createArtist, updateArtist, deleteArtist,
  approveArtist, rejectArtist, getArtistRealStatistics
} from '@/lib/api';
import { formatNumber } from '@/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Artist } from '@/types';

export default function AdminArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');

  // Add / Edit Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [formName, setFormName] = useState('');
  const [formStageName, setFormStageName] = useState('');
  const [formGenre, setFormGenre] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formVerified, setFormVerified] = useState(true);
  const [saving, setSaving] = useState(false);

  // Statistics Modal state
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedArtistForStats, setSelectedArtistForStats] = useState<Artist | null>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    setLoading(true);
    try {
      const data = await getAllArtists();
      setArtists(data);
    } catch (err: any) {
      toast.error('Failed loading artists: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingArtist(null);
    setFormName('');
    setFormStageName('');
    setFormGenre('Zambian Music');
    setFormBio('');
    setFormAvatarUrl('');
    setFormVerified(true);
    setDialogOpen(true);
  };

  const openEditDialog = (artist: Artist) => {
    setEditingArtist(artist);
    setFormName(artist.name || '');
    setFormStageName(artist.stage_name || artist.name || '');
    setFormGenre(artist.genre || 'Zambian Music');
    setFormBio(artist.bio || '');
    setFormAvatarUrl(artist.avatar_url || artist.cover_url || '');
    setFormVerified(artist.verified ?? true);
    setDialogOpen(true);
  };

  const handleSaveArtist = async () => {
    if (!formName.trim() && !formStageName.trim()) {
      toast.error('Please provide an artist name or stage name');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim() || formStageName.trim(),
        stage_name: formStageName.trim() || formName.trim(),
        genre: formGenre.trim() || 'Zambian Music',
        bio: formBio.trim(),
        avatar_url: formAvatarUrl.trim() || null,
        cover_url: formAvatarUrl.trim() || null,
        verified: formVerified,
      };

      if (editingArtist) {
        await updateArtist(editingArtist.id, payload);
        toast.success(`Artist "${payload.stage_name}" updated successfully`);
      } else {
        await createArtist(payload);
        toast.success(`Artist "${payload.stage_name}" added successfully`);
      }

      setDialogOpen(false);
      await loadArtists();
    } catch (err: any) {
      toast.error('Failed saving artist: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArtist = async (artist: Artist) => {
    const name = artist.stage_name || artist.name || 'this artist';
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteArtist(artist.id);
      toast.success(`Artist "${name}" deleted`);
      setArtists(prev => prev.filter(a => a.id !== artist.id));
    } catch (err: any) {
      toast.error('Failed deleting artist: ' + (err.message || 'Error'));
    }
  };

  const handleApprove = async (artist: Artist) => {
    try {
      await approveArtist(artist.id);
      toast.success(`Artist "${artist.stage_name || artist.name}" approved and verified!`);
      setArtists(prev => prev.map(a => a.id === artist.id ? { ...a, verified: true } : a));
    } catch (err: any) {
      toast.error('Failed approving artist: ' + (err.message || 'Error'));
    }
  };

  const handleReject = async (artist: Artist) => {
    try {
      await rejectArtist(artist.id);
      toast.info(`Artist "${artist.stage_name || artist.name}" unverified / rejected`);
      setArtists(prev => prev.map(a => a.id === artist.id ? { ...a, verified: false } : a));
    } catch (err: any) {
      toast.error('Failed un-verifying artist: ' + (err.message || 'Error'));
    }
  };

  const viewArtistStatistics = async (artist: Artist) => {
    setSelectedArtistForStats(artist);
    setStatsModalOpen(true);
    setStatsLoading(true);
    try {
      const stats = await getArtistRealStatistics(artist.id, artist.user_id);
      setStatsData(stats);
    } catch (err: any) {
      toast.error('Failed fetching real statistics: ' + err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const filteredArtists = artists.filter(a => {
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = !query ||
      (a.name || '').toLowerCase().includes(query) ||
      (a.stage_name || '').toLowerCase().includes(query) ||
      (a.genre || '').toLowerCase().includes(query);

    if (!nameMatch) return false;
    if (filterVerified === 'verified') return !!a.verified;
    if (filterVerified === 'unverified') return !a.verified;
    return true;
  });

  const totalPlays = artists.reduce((sum, a) => sum + (Number(a.play_count) || 0), 0);
  const totalFollowers = artists.reduce((sum, a) => sum + (Number(a.total_followers) || 0), 0);
  const totalVerified = artists.filter(a => a.verified).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" /> Artists Management & Live Statistics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add, edit, approve, reject and monitor registered artists, followers, plays, and revenue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadArtists} disabled={loading} className="gap-1.5 h-8 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={openAddDialog} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Artist
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border/70 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Total Artists</span>
          <p className="text-xl font-bold text-foreground mt-1">{artists.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{totalVerified} verified</p>
        </Card>
        <Card className="bg-card border-border/70 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Total Plays</span>
          <p className="text-xl font-bold text-foreground mt-1">{formatNumber(totalPlays)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Across catalog</p>
        </Card>
        <Card className="bg-card border-border/70 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Total Followers</span>
          <p className="text-xl font-bold text-primary mt-1">{formatNumber(totalFollowers)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Real follower links</p>
        </Card>
        <Card className="bg-card border-border/70 p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Monetization Active</span>
          <p className="text-xl font-bold text-emerald-500 mt-1">K0.05 / play</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Live streaming rates</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card"
          />
        </div>
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            variant={filterVerified === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterVerified('all')}
            className="h-8 text-xs"
          >
            All ({artists.length})
          </Button>
          <Button
            variant={filterVerified === 'verified' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterVerified('verified')}
            className="h-8 text-xs"
          >
            Verified ({totalVerified})
          </Button>
          <Button
            variant={filterVerified === 'unverified' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterVerified('unverified')}
            className="h-8 text-xs"
          >
            Unverified ({artists.length - totalVerified})
          </Button>
        </div>
      </div>

      {/* Artists Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] border-b border-border">
            <tr>
              <th className="py-2.5 px-3">Artist</th>
              <th className="py-2.5 px-3">Genre</th>
              <th className="py-2.5 px-3">Plays</th>
              <th className="py-2.5 px-3">Followers</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading registered artists...
                </td>
              </tr>
            ) : filteredArtists.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No artists match your criteria.
                </td>
              </tr>
            ) : (
              filteredArtists.map((artist) => {
                const displayName = artist.stage_name || artist.name || 'Artist';
                const avatar = artist.avatar_url || artist.cover_url || '/app-icon.png';
                const isVer = !!artist.verified;
                return (
                  <tr key={artist.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={avatar}
                          alt={displayName}
                          className="w-8 h-8 rounded-full object-cover bg-muted shrink-0 border border-border/80"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[150px]">
                            {displayName}
                          </p>
                          {artist.name && artist.name !== displayName && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                              {artist.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {artist.genre || 'Zambian'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                      {formatNumber(artist.play_count || 0)}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {formatNumber(artist.total_followers || 0)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <Badge
                        variant={isVer ? 'default' : 'outline'}
                        className={`text-[10px] ${isVer ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground'}`}
                      >
                        {isVer ? '✓ Verified' : 'Unverified'}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {isVer ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] px-2 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                            onClick={() => handleReject(artist)}
                            title="Un-verify Artist"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Unverify
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] px-2 text-primary hover:bg-primary/10"
                            onClick={() => handleApprove(artist)}
                            title="Approve & Verify Artist"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] px-2"
                          onClick={() => viewArtistStatistics(artist)}
                          title="View Real Statistics & Revenue"
                        >
                          <TrendingUp className="w-3.5 h-3.5 mr-1" /> Stats
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Open Public Profile"
                        >
                          <Link to={`/artist/${artist.id}`} target="_blank">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditDialog(artist)}
                          title="Edit Artist"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteArtist(artist)}
                          title="Delete Artist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Artist Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>
              {editingArtist ? 'Edit Artist Profile' : 'Add New Artist'}
            </DialogTitle>
            <DialogDescription>
              {editingArtist ? 'Update artist details, bio, genre, and verification.' : 'Create an approved artist profile in ZedVevo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Stage Name *</Label>
                <Input
                  value={formStageName}
                  onChange={(e) => setFormStageName(e.target.value)}
                  placeholder="e.g. Yo Maps"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Full Legal Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Elton Mulenga"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Genre / Category</Label>
              <Input
                value={formGenre}
                onChange={(e) => setFormGenre(e.target.value)}
                placeholder="e.g. Afrobeats / Zed / Kalindula"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Avatar / Profile Picture URL</Label>
              <Input
                value={formAvatarUrl}
                onChange={(e) => setFormAvatarUrl(e.target.value)}
                placeholder="https://... or storage link"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Biography</Label>
              <Textarea
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
                placeholder="Artist biography and musical background..."
                rows={3}
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-xs font-semibold">Verified Artist Badge</Label>
                <p className="text-[10px] text-muted-foreground">Displays official verification checkmark</p>
              </div>
              <Switch checked={formVerified} onCheckedChange={setFormVerified} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveArtist} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {editingArtist ? 'Save Changes' : 'Create Artist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Artist Statistics & Revenue Modal */}
      <Dialog open={statsModalOpen} onOpenChange={setStatsModalOpen}>
        <DialogContent className="max-w-xl bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Real Statistics: {selectedArtistForStats?.stage_name || selectedArtistForStats?.name}
            </DialogTitle>
            <DialogDescription>
              Live metrics computed from actual Supabase database records.
            </DialogDescription>
          </DialogHeader>

          {statsLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Computing live database statistics...
            </div>
          ) : statsData ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground uppercase">Followers</span>
                  <p className="text-lg font-bold text-foreground mt-0.5">{statsData.total_followers}</p>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground uppercase">Total Plays</span>
                  <p className="text-lg font-bold text-foreground mt-0.5">{statsData.total_plays}</p>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground uppercase">Total Likes</span>
                  <p className="text-lg font-bold text-rose-500 mt-0.5">{statsData.total_likes}</p>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground uppercase">Balance</span>
                  <p className="text-lg font-bold text-primary mt-0.5">K{statsData.available_balance.toFixed(2)}</p>
                </div>
              </div>

              {/* Revenue & Payout Breakdown */}
              <div className="border border-border rounded-xl p-3 bg-card/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Cumulative Earnings:</span>
                  <span className="font-bold text-emerald-500">K{statsData.total_earnings.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Pending Earnings:</span>
                  <span className="font-semibold text-amber-500">K{statsData.pending_earnings.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Withdrawn Payouts:</span>
                  <span className="font-semibold text-foreground">K{statsData.withdrawn_earnings.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Song Streams:</span>
                  <span className="font-semibold text-foreground">{statsData.song_plays}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Video Views:</span>
                  <span className="font-semibold text-foreground">{statsData.video_plays}</span>
                </div>
              </div>

              {/* Transactions */}
              <div>
                <h4 className="text-xs font-semibold mb-2">Verified Transaction History ({statsData.transactions?.length || 0})</h4>
                {statsData.transactions?.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No direct payment transactions on record yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y divide-border/60 border border-border rounded-lg text-xs">
                    {statsData.transactions.map((t: any) => (
                      <div key={t.id} className="p-2 flex items-center justify-between">
                        <div>
                          <p className="font-medium capitalize">{t.payment_type}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(t.created_at)}</p>
                        </div>
                        <span className="font-bold text-emerald-500">+K{Number(t.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button size="sm" onClick={() => setStatsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
