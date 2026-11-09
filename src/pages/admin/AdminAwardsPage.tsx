import React, { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle, Star, RefreshCw, Loader2,
  Search, Award as AwardIcon, Trophy, Vote as VoteIcon, Building2,
  TrendingUp, DollarSign, Upload, Check, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  getAllAwards, createAward, updateAward, deleteAward,
  createAwardCategory, updateAwardCategory, deleteAwardCategory,
  getAllNominees, updateNomineeStatus, updateNominee, deleteNominee, setWinner,
  getAllVotes, createManualVote, deleteVote,
  getAllSponsors, createSponsor, updateSponsor, deleteSponsor,
  getAllWinnersOfMonth, upsertWinnerOfMonth, publishWinnerOfMonth,
  getWeeklyTrending, computeAndStoreWeeklyTrending,
  createNotification, uploadFile,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Award, AwardCategory, Nominee, WinnerOfMonth, WeeklyTrending, Sponsor } from '@/types/index';

export default function AdminAwardsPage() {
  const [awards, setAwards]         = useState<Award[]>([]);
  const [nominees, setNominees]     = useState<Nominee[]>([]);
  const [votes, setVotes]           = useState<any[]>([]);
  const [sponsors, setSponsors]     = useState<Sponsor[]>([]);
  const [winners, setWinners]       = useState<WinnerOfMonth[]>([]);
  const [trending, setTrending]     = useState<WeeklyTrending[]>([]);
  const [loading, setLoading]       = useState(true);
  const [votesLoading, setVotesLoading] = useState(false);
  const [trendRefreshing, setTrendRefreshing] = useState(false);
  const [votePrice, setVotePrice]   = useState('5.00');
  const [regFee, setRegFee]         = useState('100.00');

  // Search & Filters
  const [nomineeSearch, setNomineeSearch] = useState('');
  const [nomineeCatFilter, setNomineeCatFilter] = useState('all');
  const [voteSearch, setVoteSearch] = useState('');

  // Award dialog
  const [awardDlg, setAwardDlg]     = useState<{ open: boolean; award?: Award }>({ open: false });
  const [awardName, setAwardName]   = useState('');
  const [awardDesc, setAwardDesc]   = useState('');
  const [awardYear, setAwardYear]   = useState(new Date().getFullYear().toString());
  const [awardVoting, setAwardVoting] = useState(false);
  const [awardSaving, setAwardSaving] = useState(false);

  // Category dialog
  const [catDlg, setCatDlg]         = useState<{ open: boolean; category?: AwardCategory; awardId?: string }>({ open: false });
  const [catName, setCatName]       = useState('');
  const [catPrize, setCatPrize]     = useState('');
  const [catSaving, setCatSaving]   = useState(false);

  // Nominee Add/Edit dialog
  const [nomineeDlg, setNomineeDlg] = useState<{ open: boolean; nominee?: Nominee }>({ open: false });
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeSongTitle, setNomineeSongTitle] = useState('');
  const [nomineeCategoryId, setNomineeCategoryId] = useState('');
  const [nomineeVotes, setNomineeVotes] = useState('0');
  const [nomineePhotoUrl, setNomineePhotoUrl] = useState('');
  const [nomineePhoto, setNomineePhoto] = useState<File | null>(null);
  const [nomineeStatus, setNomineeStatus] = useState('approved');
  const [nomineeIsWinner, setNomineeIsWinner] = useState(false);
  const [nomineeSaving, setNomineeSaving] = useState(false);

  // Manual Vote dialog
  const [manualVoteDlg, setManualVoteDlg] = useState(false);
  const [selectedNomineeId, setSelectedNomineeId] = useState('');
  const [manualVoteCount, setManualVoteCount] = useState('10');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('manual_momo');
  const [manualVoteNotes, setManualVoteNotes] = useState('');
  const [manualVoteSaving, setManualVoteSaving] = useState(false);

  // Sponsor dialog
  const [sponsorDlg, setSponsorDlg] = useState<{ open: boolean; sponsor?: Sponsor }>({ open: false });
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorWebsite, setSponsorWebsite] = useState('');
  const [sponsorTier, setSponsorTier] = useState<'gold' | 'silver' | 'bronze'>('gold');
  const [sponsorDisplayOrder, setSponsorDisplayOrder] = useState('0');
  const [sponsorActive, setSponsorActive] = useState(true);
  const [sponsorAwardId, setSponsorAwardId] = useState<string>('');
  const [sponsorSaving, setSponsorSaving] = useState(false);

  // Winner of month dialog
  const [womDlg, setWomDlg]         = useState(false);
  const [womName, setWomName]       = useState('');
  const [womAward, setWomAward]     = useState('');
  const [womPrize, setWomPrize]     = useState('');
  const [womDesc, setWomDesc]       = useState('');
  const [womMonth, setWomMonth]     = useState(new Date().getMonth() + 1);
  const [womYear2, setWomYear2]     = useState(new Date().getFullYear());
  const [womPhoto, setWomPhoto]     = useState<File | null>(null);
  const [womSaving, setWomSaving]   = useState(false);

  const loadData = async () => {
    try {
      const [a, n, w, t, s, v] = await Promise.all([
        getAllAwards(),
        getAllNominees(),
        getAllWinnersOfMonth(),
        getWeeklyTrending(),
        getAllSponsors().catch(() => []),
        getAllVotes().catch(() => []),
      ]);
      setAwards(a);
      setNominees(n);
      setWinners(w);
      setTrending(t);
      setSponsors(s);
      setVotes(v);
    } catch (e) {
      console.error('Error loading awards data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    async function loadPrices() {
      try {
        const { supabase } = await import('@/db/supabase');
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['vote_min_amount', 'nominee_registration_fee']);
        if (settingsData) {
          const p = settingsData.find(s => s.key === 'vote_min_amount')?.value;
          const f = settingsData.find(s => s.key === 'nominee_registration_fee')?.value;
          if (p) setVotePrice(p);
          if (f) setRegFee(f);
        }
      } catch (err) {
        console.warn('Failed to load pricing settings:', err);
      }
    }
    loadPrices();
  }, []);

  // Award Handlers
  const openAwardDlg = (award?: Award) => {
    setAwardName(award?.name || '');
    setAwardDesc(award?.description || '');
    setAwardYear(String(award?.year || new Date().getFullYear()));
    setAwardVoting(award?.voting_open || false);
    setAwardDlg({ open: true, award });
  };

  const handleSaveAward = async () => {
    if (!awardName.trim()) { toast.error('Award name required'); return; }
    setAwardSaving(true);
    try {
      const payload = {
        name: awardName.trim(),
        description: awardDesc.trim() || undefined,
        year: parseInt(awardYear) || new Date().getFullYear(),
        voting_open: awardVoting,
        is_active: true
      };
      if (awardDlg.award) {
        await updateAward(awardDlg.award.id, payload);
      } else {
        await createAward(payload);
      }
      setAwards(await getAllAwards());
      toast.success(`Award ${awardDlg.award ? 'updated' : 'created'}`);
      setAwardDlg({ open: false });
    } catch (e: any) {
      toast.error(e.message || 'Failed to save award');
    } finally {
      setAwardSaving(false);
    }
  };

  const handleDeleteAward = async (id: string) => {
    if (!confirm('Are you sure you want to delete this award and all its categories?')) return;
    try {
      await deleteAward(id);
      setAwards(await getAllAwards());
      toast.success('Award deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete award');
    }
  };

  // Category Handlers
  const openCatDlg = (awardId: string, cat?: AwardCategory) => {
    setCatName(cat?.name || '');
    setCatPrize(cat?.grand_prize || '');
    setCatDlg({ open: true, category: cat, awardId });
  };

  const handleSaveCat = async () => {
    if (!catName.trim()) { toast.error('Category name required'); return; }
    setCatSaving(true);
    try {
      const payload = {
        name: catName.trim(),
        grand_prize: catPrize.trim() || undefined,
        is_active: true,
        award_id: catDlg.awardId!
      };
      if (catDlg.category) {
        await updateAwardCategory(catDlg.category.id, payload);
      } else {
        await createAwardCategory(payload);
      }
      setAwards(await getAllAwards());
      toast.success(`Category ${catDlg.category ? 'updated' : 'created'}`);
      setCatDlg({ open: false });
    } catch (e: any) {
      toast.error(e.message || 'Failed to save category');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await deleteAwardCategory(id);
      setAwards(await getAllAwards());
      toast.success('Category deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete category');
    }
  };

  // Nominee Handlers
  const openNomineeModal = (nom?: Nominee) => {
    if (nom) {
      setNomineeName(nom.name || '');
      setNomineeSongTitle(nom.song_title || '');
      setNomineeCategoryId(nom.category_id || '');
      setNomineeVotes(String(nom.total_votes || 0));
      setNomineePhotoUrl(nom.photo_url || '');
      setNomineeStatus(nom.nomination_status || 'approved');
      setNomineeIsWinner(nom.is_winner || nom.nomination_status === 'winner');
      setNomineePhoto(null);
      setNomineeDlg({ open: true, nominee: nom });
    } else {
      setNomineeName('');
      setNomineeSongTitle('');
      setNomineeCategoryId(awards[0]?.award_categories?.[0]?.id || '');
      setNomineeVotes('0');
      setNomineePhotoUrl('');
      setNomineeStatus('approved');
      setNomineeIsWinner(false);
      setNomineePhoto(null);
      setNomineeDlg({ open: true });
    }
  };

  const handleSaveNominee = async () => {
    if (!nomineeName.trim() || !nomineeCategoryId) {
      toast.error('Artist/Nominee name and Category are required');
      return;
    }
    setNomineeSaving(true);
    try {
      let finalPhotoUrl = nomineePhotoUrl;
      if (nomineePhoto) {
        const timestamp = Date.now();
        const ext = nomineePhoto.name.split('.').pop() || 'jpg';
        const path = `nominee_${timestamp}.${ext}`;
        finalPhotoUrl = await uploadFile('nominees', path, nomineePhoto);
      }

      const voteNum = parseInt(nomineeVotes) || 0;
      const effectiveStatus = nomineeIsWinner ? 'winner' : nomineeStatus;

      if (nomineeDlg.nominee) {
        // Edit existing
        await updateNominee(nomineeDlg.nominee.id, {
          name: nomineeName.trim(),
          song_title: nomineeSongTitle.trim() || null,
          category_id: nomineeCategoryId,
          photo_url: finalPhotoUrl || null,
          total_votes: voteNum,
          nomination_status: effectiveStatus,
          is_winner: nomineeIsWinner,
        });
        toast.success(`Nominee "${nomineeName}" updated!`);
      } else {
        // Create new
        const { supabase } = await import('@/db/supabase');
        const { error } = await supabase.from('nominees').insert({
          name: nomineeName.trim(),
          song_title: nomineeSongTitle.trim() || null,
          category_id: nomineeCategoryId,
          photo_url: finalPhotoUrl || null,
          total_votes: voteNum,
          registration_status: 'completed',
          nomination_status: effectiveStatus,
          is_winner: nomineeIsWinner,
        });
        if (error) throw error;
        toast.success(`Nominee "${nomineeName}" created!`);
      }

      setNominees(await getAllNominees());
      setNomineeDlg({ open: false });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save nominee');
    } finally {
      setNomineeSaving(false);
    }
  };

  const handleDeleteNominee = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete nominee "${name}" and all their vote logs?`)) return;
    try {
      await deleteNominee(id);
      setNominees(p => p.filter(n => n.id !== id));
      toast.success(`Nominee "${name}" deleted`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete nominee');
    }
  };

  // Vote Handlers
  const handleAddManualVotes = async () => {
    if (!selectedNomineeId) {
      toast.error('Please select a nominee');
      return;
    }
    const count = parseInt(manualVoteCount);
    if (isNaN(count) || count <= 0) {
      toast.error('Please enter a valid vote quantity (at least 1)');
      return;
    }

    setManualVoteSaving(true);
    try {
      await createManualVote({
        nominee_id: selectedNomineeId,
        vote_count: count,
        payment_method: manualPaymentMethod,
        notes: manualVoteNotes.trim() || 'Manual bulk votes recorded by Admin',
      });

      const [nList, vList] = await Promise.all([getAllNominees(), getAllVotes()]);
      setNominees(nList);
      setVotes(vList);
      toast.success(`Successfully credited ${count} votes!`);
      setManualVoteDlg(false);
      setManualVoteNotes('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add votes');
    } finally {
      setManualVoteSaving(false);
    }
  };

  const handleDeleteVoteRecord = async (id: string) => {
    if (!confirm('Delete this vote log? Note: this will remove the transaction record.')) return;
    try {
      await deleteVote(id);
      setVotes(p => p.filter(v => v.id !== id));
      toast.success('Vote record removed');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete vote');
    }
  };

  // Sponsors Handlers
  const openSponsorModal = (s?: Sponsor) => {
    setSponsorName(s?.name || '');
    setSponsorLogoUrl(s?.logo_url || '');
    setSponsorWebsite(s?.website_url || '');
    setSponsorTier((s?.tier as any) || 'gold');
    setSponsorDisplayOrder(String(s?.display_order ?? 0));
    setSponsorActive(s?.is_active ?? true);
    setSponsorAwardId(s?.award_id || '');
    setSponsorDlg({ open: true, sponsor: s });
  };

  const handleSaveSponsor = async () => {
    if (!sponsorName.trim()) { toast.error('Sponsor name is required'); return; }
    setSponsorSaving(true);
    try {
      const payload = {
        name: sponsorName.trim(),
        logo_url: sponsorLogoUrl.trim() || undefined,
        website_url: sponsorWebsite.trim() || undefined,
        tier: sponsorTier,
        display_order: parseInt(sponsorDisplayOrder) || 0,
        is_active: sponsorActive,
        award_id: sponsorAwardId || null,
      };
      if (sponsorDlg.sponsor) {
        await updateSponsor(sponsorDlg.sponsor.id, payload);
        toast.success('Sponsor updated');
      } else {
        await createSponsor(payload);
        toast.success('Sponsor created');
      }
      setSponsors(await getAllSponsors());
      setSponsorDlg({ open: false });
    } catch (e: any) {
      toast.error(e.message || 'Failed to save sponsor');
    } finally {
      setSponsorSaving(false);
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sponsor?')) return;
    try {
      await deleteSponsor(id);
      setSponsors(p => p.filter(s => s.id !== id));
      toast.success('Sponsor deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete sponsor');
    }
  };

  // Winner of month Handlers
  const handleSaveWinner = async () => {
    if (!womName || !womAward) { toast.error('Artist name and award required'); return; }
    setWomSaving(true);
    try {
      let photoUrl: string | undefined;
      if (womPhoto) {
        photoUrl = await uploadFile('thumbnails', `wom_${Date.now()}.${womPhoto.name.split('.').pop()}`, womPhoto);
      }
      await upsertWinnerOfMonth({
        artist_name: womName,
        award: womAward,
        prize: womPrize || undefined,
        description: womDesc || undefined,
        month: womMonth,
        year: womYear2,
        photo_url: photoUrl,
        is_published: false
      });
      setWinners(await getAllWinnersOfMonth());
      toast.success('Winner saved (not yet published)');
      setWomDlg(false);
    } catch {
      toast.error('Failed to save winner');
    } finally {
      setWomSaving(false);
    }
  };

  const handlePublishWinner = async (id: string) => {
    await publishWinnerOfMonth(id);
    await createNotification({
      title: '⭐ Winner of the Month Announced!',
      message: "Check out this month's winner on the Awards page.",
      type: 'success',
      notification_type: 'winner_of_month',
      link: '/awards'
    });
    setWinners(await getAllWinnersOfMonth());
    toast.success('Winner published and users notified');
  };

  const handleRefreshTrending = async () => {
    setTrendRefreshing(true);
    try {
      await computeAndStoreWeeklyTrending();
      setTrending(await getWeeklyTrending());
      toast.success('Trending list refreshed');
    } catch (e) {
      toast.error('Failed to recalculate trending');
    } finally {
      setTrendRefreshing(false);
    }
  };

  // Flattened Categories for dropdowns
  const allCategories = awards.flatMap(a => (a.award_categories || []).map(c => ({ ...c, awardName: a.name })));

  // Filtered Nominees
  const filteredNominees = nominees.filter(n => {
    const matchesSearch = !nomineeSearch ||
      n.name.toLowerCase().includes(nomineeSearch.toLowerCase()) ||
      (n.song_title && n.song_title.toLowerCase().includes(nomineeSearch.toLowerCase()));
    const matchesCat = nomineeCatFilter === 'all' || n.category_id === nomineeCatFilter;
    return matchesSearch && matchesCat;
  });

  // Filtered Votes
  const filteredVotes = votes.filter(v => {
    if (!voteSearch) return true;
    const term = voteSearch.toLowerCase();
    const nomName = v.nominees?.name || '';
    const catName = v.nominees?.award_categories?.name || '';
    const method = v.payment_method || '';
    const user = v.profiles?.username || v.profiles?.display_name || '';
    return nomName.toLowerCase().includes(term) ||
           catName.toLowerCase().includes(term) ||
           method.toLowerCase().includes(term) ||
           user.toLowerCase().includes(term);
  });

  // Vote Aggregates
  const totalVotesCast = nominees.reduce((acc, n) => acc + (n.total_votes || 0), 0);
  const totalVoteRevenue = totalVotesCast * (parseFloat(votePrice) || 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Awards & Voting Center</h1>
          <p className="text-sm text-muted-foreground">
            Manage awards, categories, nominees, live votes, sponsors, and weekly trending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
            onClick={() => openNomineeModal()}
          >
            <Plus className="h-3.5 w-3.5" /> Add Nominee
          </Button>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-card border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-accent/15 text-accent shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Awards</p>
              <p className="text-xl font-bold">{awards.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-500 shrink-0">
              <AwardIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Nominees</p>
              <p className="text-xl font-bold">{nominees.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
              <VoteIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Votes Cast</p>
              <p className="text-xl font-bold">{totalVotesCast.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-500 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Est. Vote Value</p>
              <p className="text-xl font-bold text-amber-500">ZMW {totalVoteRevenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="nominees" className="space-y-4">
        <TabsList className="bg-muted/70 p-1 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="nominees" className="gap-1.5 text-xs py-1.5">
            <AwardIcon className="h-3.5 w-3.5" /> Nominees ({nominees.length})
          </TabsTrigger>
          <TabsTrigger value="votes" className="gap-1.5 text-xs py-1.5">
            <VoteIcon className="h-3.5 w-3.5" /> Live Votes ({votes.length})
          </TabsTrigger>
          <TabsTrigger value="awards" className="gap-1.5 text-xs py-1.5">
            <Trophy className="h-3.5 w-3.5" /> Awards & Categories ({awards.length})
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="gap-1.5 text-xs py-1.5">
            <Building2 className="h-3.5 w-3.5" /> Sponsors ({sponsors.length})
          </TabsTrigger>
          <TabsTrigger value="winners" className="gap-1.5 text-xs py-1.5">
            <Star className="h-3.5 w-3.5" /> Winners of Month
          </TabsTrigger>
          <TabsTrigger value="trending" className="gap-1.5 text-xs py-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Weekly Trending
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB: NOMINEES */}
        {/* ============================================================ */}
        <TabsContent value="nominees" className="space-y-4">
          {/* Pricing Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
            <div>
              <Label className="text-xs font-semibold">Price Per Vote (ZMW)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  className="h-8 text-xs max-w-[120px] bg-background"
                  value={votePrice}
                  onChange={e => setVotePrice(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={async () => {
                    try {
                      const { supabase } = await import('@/db/supabase');
                      await supabase.from('app_settings').upsert({ key: 'vote_min_amount', value: votePrice }, { onConflict: 'key' });
                      toast.success('Vote price updated successfully!');
                    } catch (e: any) {
                      toast.error('Failed to update vote price');
                    }
                  }}
                >
                  Save Price
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Nominee Registration Fee (ZMW)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  className="h-8 text-xs max-w-[120px] bg-background"
                  value={regFee}
                  onChange={e => setRegFee(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={async () => {
                    try {
                      const { supabase } = await import('@/db/supabase');
                      await supabase.from('app_settings').upsert({ key: 'nominee_registration_fee', value: regFee }, { onConflict: 'key' });
                      toast.success('Nominee registration fee updated successfully!');
                    } catch (e: any) {
                      toast.error('Failed to update registration fee');
                    }
                  }}
                >
                  Save Fee
                </Button>
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search nominees by artist or song..."
                  className="h-8 pl-8 text-xs bg-background"
                  value={nomineeSearch}
                  onChange={e => setNomineeSearch(e.target.value)}
                />
              </div>
              <Select value={nomineeCatFilter} onValueChange={setNomineeCatFilter}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8"
                onClick={() => setManualVoteDlg(true)}
              >
                <Plus className="h-3.5 w-3.5 text-accent" /> Add Offline / SMS Votes
              </Button>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs h-8"
                onClick={() => openNomineeModal()}
              >
                <Plus className="h-3.5 w-3.5" /> Add Nominee
              </Button>
            </div>
          </div>

          {/* Nominees Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Nominee / Artist', 'Work / Song', 'Category', 'Status', 'Votes (Editable)', 'Registered', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : filteredNominees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                      No nominees matching your filter. Click "Add Nominee" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredNominees.map(nom => (
                    <tr key={nom.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-2.5">
                          {nom.photo_url ? (
                            <img src={nom.photo_url} alt={nom.name} className="h-7 w-7 rounded-full object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                              {nom.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-foreground">{nom.name}</span>
                            {nom.is_winner && (
                              <Badge className="ml-2 bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px]">
                                🏆 Winner
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {nom.song_title ? `"${nom.song_title}"` : '—'}
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs font-medium">
                        {(nom.award_categories as { name?: string } | null)?.name ?? 'General'}
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Badge
                          variant={
                            nom.nomination_status === 'approved'
                              ? 'default'
                              : nom.nomination_status === 'winner'
                              ? 'default'
                              : nom.nomination_status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-[10px] capitalize"
                        >
                          {nom.nomination_status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground">
                        <Input
                          type="number"
                          className="h-7 w-24 text-xs font-semibold bg-background border border-input text-center rounded"
                          defaultValue={nom.total_votes ?? 0}
                          onBlur={async (e) => {
                            const val = parseInt(e.target.value);
                            if (isNaN(val)) return;
                            if (val === nom.total_votes) return;
                            try {
                              const { supabase } = await import('@/db/supabase');
                              const { error } = await supabase
                                .from('nominees')
                                .update({ total_votes: val })
                                .eq('id', nom.id);
                              if (error) throw error;
                              setNominees(prev => prev.map(n => n.id === nom.id ? { ...n, total_votes: val } : n));
                              toast.success(`Votes updated for ${nom.name}`);
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to update votes');
                            }
                          }}
                        />
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(nom.created_at)}
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {nom.nomination_status === 'pending_review' && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600 hover:bg-green-600/10"
                                title="Approve"
                                onClick={async () => {
                                  await updateNomineeStatus(nom.id, 'approved');
                                  await createNotification({
                                    user_id: nom.user_id,
                                    title: '✅ Nomination Approved',
                                    message: `Your nomination for "${nom.name}" has been approved!`,
                                    type: 'success',
                                    notification_type: 'nomination_approved'
                                  });
                                  setNominees(p => p.map(n => n.id === nom.id ? { ...n, nomination_status: 'approved' } : n));
                                  toast.success('Nominee approved');
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="Reject"
                                onClick={async () => {
                                  await updateNomineeStatus(nom.id, 'rejected');
                                  await createNotification({
                                    user_id: nom.user_id,
                                    title: '❌ Nomination Rejected',
                                    message: `Your nomination for "${nom.name}" was not approved.`,
                                    type: 'error',
                                    notification_type: 'nomination_rejected'
                                  });
                                  setNominees(p => p.map(n => n.id === nom.id ? { ...n, nomination_status: 'rejected' } : n));
                                  toast.success('Nominee rejected');
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          {nom.nomination_status === 'approved' && !nom.is_winner && (
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={async () => {
                                await setWinner(nom.id);
                                await createNotification({
                                  title: '🏆 Award Winner Announced!',
                                  message: `${nom.name} has been declared a winner!`,
                                  type: 'success',
                                  notification_type: 'award_winner',
                                  link: '/awards'
                                });
                                setNominees(p => p.map(n => n.id === nom.id ? { ...n, nomination_status: 'winner', is_winner: true } : n));
                                toast.success(`${nom.name} declared winner!`);
                              }}
                            >
                              Set Winner
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-muted"
                            title="Edit Nominee & Votes"
                            onClick={() => openNomineeModal(nom)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title="Delete Nominee"
                            onClick={() => handleDeleteNominee(nom.id, nom.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: LIVE VOTES LOG */}
        {/* ============================================================ */}
        <TabsContent value="votes" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search votes by nominee, category, or payment..."
                className="h-8 pl-8 text-xs bg-background"
                value={voteSearch}
                onChange={e => setVoteSearch(e.target.value)}
              />
            </div>

            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs h-8"
              onClick={() => setManualVoteDlg(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Record Manual / SMS Votes
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Nominee', 'Category', 'Vote Count', 'Payment Method', 'Voter', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {votes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                      No vote transactions recorded yet. Votes cast by users or added via admin will appear here in real time.
                    </td>
                  </tr>
                ) : filteredVotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      No votes matching search term.
                    </td>
                  </tr>
                ) : (
                  filteredVotes.map(v => (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-medium">
                        {v.nominees?.name || 'Nominee #' + (v.nominee_id ? v.nominee_id.slice(0, 8) : '—')}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {v.nominees?.award_categories?.name || 'General'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-accent">
                        +{v.vote_count ?? 1} votes
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {v.payment_method || 'Mobile Money'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {v.profiles?.display_name || v.profiles?.username || 'Public Voter'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(v.created_at)}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Delete Vote Log"
                          onClick={() => handleDeleteVoteRecord(v.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: AWARDS & CATEGORIES */}
        {/* ============================================================ */}
        <TabsContent value="awards" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Create awards events (e.g. ZedVevo Music Awards {new Date().getFullYear()}) and manage their categories.</p>
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
              onClick={() => openAwardDlg()}
            >
              <Plus className="h-3.5 w-3.5" /> Add Award Event
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {awards.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-xs">
                No awards created yet. Click "Add Award Event" above.
              </Card>
            ) : (
              awards.map(award => (
                <Card key={award.id} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-accent" />
                          {award.name}
                          <Badge variant="outline" className="text-[10px] font-mono">{award.year}</Badge>
                          {award.voting_open && <Badge className="bg-green-600 text-white text-[10px]">Voting Open</Badge>}
                        </CardTitle>
                        {award.description && <CardDescription className="text-xs mt-1">{award.description}</CardDescription>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openCatDlg(award.id)}>
                          <Plus className="h-3 w-3" /> Add Category
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openAwardDlg(award)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteAward(award.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Categories ({(award.award_categories || []).length})</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {(award.award_categories || []).map(cat => {
                          const catNomineesCount = nominees.filter(n => n.category_id === cat.id).length;
                          return (
                            <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                              <div>
                                <p className="text-xs font-semibold text-foreground">{cat.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{catNomineesCount} Nominees</span>
                                  {cat.grand_prize && (
                                    <span className="text-[10px] text-amber-500 font-medium">Prize: {cat.grand_prize}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openCatDlg(award.id, cat)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: SPONSORS */}
        {/* ============================================================ */}
        <TabsContent value="sponsors" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Manage official sponsors, partner brands, and their ad placements.</p>
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
              onClick={() => openSponsorModal()}
            >
              <Plus className="h-3.5 w-3.5" /> Add Sponsor
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Logo', 'Name', 'Tier', 'Website', 'Order', 'Active', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sponsors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      No sponsors registered yet. Click "Add Sponsor" to add partners.
                    </td>
                  </tr>
                ) : (
                  sponsors.map(s => (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {s.logo_url ? (
                          <img src={s.logo_url} alt={s.name} className="h-7 w-7 rounded object-cover border border-border" />
                        ) : (
                          <div className="h-7 w-7 rounded bg-muted flex items-center justify-center text-xs font-bold">—</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-medium">{s.name}</td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] capitalize font-semibold">
                          {s.tier}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs max-w-[160px] truncate">
                        {s.website_url ? (
                          <a href={s.website_url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                            {s.website_url} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs font-mono">
                        {s.display_order}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={async v => {
                            await updateSponsor(s.id, { is_active: v });
                            setSponsors(p => p.map(x => x.id === s.id ? { ...x, is_active: v } : x));
                            toast.success(`Sponsor ${v ? 'activated' : 'deactivated'}`);
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openSponsorModal(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSponsor(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: WINNERS OF THE MONTH */}
        {/* ============================================================ */}
        <TabsContent value="winners" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Highlight Zambian artists and monthly award recipients.</p>
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
              onClick={() => { setWomName(''); setWomAward(''); setWomPrize(''); setWomDesc(''); setWomPhoto(null); setWomDlg(true); }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Winner
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {winners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center col-span-full">No winners recorded yet</p>
            ) : (
              winners.map(w => (
                <Card key={w.id} className={w.is_published ? 'border-accent/40' : ''}>
                  <CardContent className="flex gap-3 py-3">
                    <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0 border border-border">
                      {w.photo_url ? (
                        <img src={w.photo_url} alt={w.artist_name} className="w-full h-full object-cover" />
                      ) : (
                        <Star className="h-6 w-6 text-muted-foreground m-auto mt-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{w.artist_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{w.award}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.year, w.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {!w.is_published ? (
                          <Button
                            size="sm"
                            className="h-6 text-[10px] px-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                            onClick={() => handlePublishWinner(w.id)}
                          >
                            Publish & Notify
                          </Button>
                        ) : (
                          <Badge variant="default" className="text-[10px]">Published</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: WEEKLY TRENDING */}
        {/* ============================================================ */}
        <TabsContent value="trending" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{trending.length} entries on the weekly trending chart</p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={handleRefreshTrending}
              disabled={trendRefreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${trendRefreshing ? 'animate-spin' : ''}`} /> Recalculate Ranks
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Rank', 'Title', 'Artist', 'Type', 'Category', 'Trending Score'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trending.slice(0, 50).map(t => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-accent">#{t.rank}</td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap max-w-[160px] truncate font-medium">{t.title}</td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground">{t.artist_name}</td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] capitalize">{t.content_type}</Badge>
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-muted-foreground text-xs">{t.category || 'Music'}</td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-xs">{t.metric_value ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOG: EDIT / ADD NOMINEE */}
      {/* ============================================================ */}
      <Dialog open={nomineeDlg.open} onOpenChange={o => setNomineeDlg(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{nomineeDlg.nominee ? 'Edit Nominee & Votes' : 'Add New Nominee'}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure artist details, category, vote tally, and winner status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold">Artist / Nominee Name *</Label>
              <Input
                className="mt-1 text-xs"
                placeholder="e.g. Yo Maps"
                value={nomineeName}
                onChange={e => setNomineeName(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Song / Work Title (Optional)</Label>
              <Input
                className="mt-1 text-xs"
                placeholder="e.g. Kondwa"
                value={nomineeSongTitle}
                onChange={e => setNomineeSongTitle(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Category *</Label>
              <Select value={nomineeCategoryId} onValueChange={setNomineeCategoryId}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Select an Award Category" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.awardName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Total Votes Count</Label>
                <Input
                  type="number"
                  className="mt-1 text-xs font-semibold"
                  value={nomineeVotes}
                  onChange={e => setNomineeVotes(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Nomination Status</Label>
                <Select value={nomineeStatus} onValueChange={setNomineeStatus}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="winner">Winner</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Photo URL</Label>
              <Input
                className="mt-1 text-xs font-mono"
                placeholder="https://..."
                value={nomineePhotoUrl}
                onChange={e => setNomineePhotoUrl(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Or Upload Photo File</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1 text-xs"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setNomineePhoto(e.target.files[0]);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div>
                <p className="text-xs font-semibold text-amber-500">Declared Winner</p>
                <p className="text-[10px] text-muted-foreground">Mark this nominee as the official award winner</p>
              </div>
              <Switch checked={nomineeIsWinner} onCheckedChange={setNomineeIsWinner} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNomineeDlg({ open: false })}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSaveNominee}
              disabled={nomineeSaving}
            >
              {nomineeSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {nomineeDlg.nominee ? 'Save Changes' : 'Create Nominee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: MANUAL / OFFLINE SMS VOTES */}
      {/* ============================================================ */}
      <Dialog open={manualVoteDlg} onOpenChange={setManualVoteDlg}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual / Offline SMS Votes</DialogTitle>
            <DialogDescription className="text-xs">
              Credit bulk SMS votes or Airtel/MTN mobile money offline payments to any nominee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold">Target Nominee *</Label>
              <Select value={selectedNomineeId} onValueChange={setSelectedNomineeId}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Select Nominee..." />
                </SelectTrigger>
                <SelectContent>
                  {nominees.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name} {n.song_title ? `("${n.song_title}")` : ''} — Current: {n.total_votes || 0} votes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Vote Quantity to Add *</Label>
                <Input
                  type="number"
                  min="1"
                  className="mt-1 text-xs font-bold"
                  value={manualVoteCount}
                  onChange={e => setManualVoteCount(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Payment Channel</Label>
                <Select value={manualPaymentMethod} onValueChange={setManualPaymentMethod}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms_gateway">SMS Gateway</SelectItem>
                    <SelectItem value="airtel_momo">Airtel Money</SelectItem>
                    <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
                    <SelectItem value="zamtel_kwacha">Zamtel Kwacha</SelectItem>
                    <SelectItem value="cash_offline">Cash / Event Box</SelectItem>
                    <SelectItem value="admin_adjustment">Admin Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Notes / Reference (Optional)</Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs"
                placeholder="e.g. Batch #492 from SMS aggregator or live event votes"
                value={manualVoteNotes}
                onChange={e => setManualVoteNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualVoteDlg(false)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleAddManualVotes}
              disabled={manualVoteSaving}
            >
              {manualVoteSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Credit Votes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: ADD / EDIT AWARD EVENT */}
      {/* ============================================================ */}
      <Dialog open={awardDlg.open} onOpenChange={o => setAwardDlg(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{awardDlg.award ? 'Edit Award Event' : 'Create Award Event'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Award Name *</Label>
              <Input
                className="mt-1 text-xs"
                value={awardName}
                onChange={e => setAwardName(e.target.value)}
                placeholder="e.g. ZedVevo Music Awards"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                className="mt-1 text-xs"
                rows={2}
                value={awardDesc}
                onChange={e => setAwardDesc(e.target.value)}
                placeholder="Annual celebration of Zambian music excellence"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Year</Label>
                <Input
                  type="number"
                  className="mt-1 text-xs font-mono"
                  value={awardYear}
                  onChange={e => setAwardYear(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={awardVoting} onCheckedChange={setAwardVoting} />
                <Label className="text-xs font-medium">Voting Open</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDlg({ open: false })}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSaveAward}
              disabled={awardSaving}
            >
              {awardSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: ADD / EDIT CATEGORY */}
      {/* ============================================================ */}
      <Dialog open={catDlg.open} onOpenChange={o => setCatDlg(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{catDlg.category ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Category Name *</Label>
              <Input
                className="mt-1 text-xs"
                value={catName}
                onChange={e => setCatName(e.target.value)}
                placeholder="e.g. Best Male Artist, Song of the Year"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Grand Prize (Optional)</Label>
              <Input
                className="mt-1 text-xs"
                value={catPrize}
                onChange={e => setCatPrize(e.target.value)}
                placeholder="e.g. ZMW 50,000 + Studio Contract"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDlg({ open: false })}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSaveCat}
              disabled={catSaving}
            >
              {catSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: ADD / EDIT SPONSOR */}
      {/* ============================================================ */}
      <Dialog open={sponsorDlg.open} onOpenChange={o => setSponsorDlg(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{sponsorDlg.sponsor ? 'Edit Sponsor' : 'Add Sponsor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Sponsor / Brand Name *</Label>
              <Input
                className="mt-1 text-xs"
                value={sponsorName}
                onChange={e => setSponsorName(e.target.value)}
                placeholder="e.g. MTN Zambia, Zambian Breweries"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Logo URL</Label>
              <Input
                className="mt-1 text-xs font-mono"
                value={sponsorLogoUrl}
                onChange={e => setSponsorLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Website URL</Label>
              <Input
                className="mt-1 text-xs font-mono"
                value={sponsorWebsite}
                onChange={e => setSponsorWebsite(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tier</Label>
                <Select value={sponsorTier} onValueChange={(v: any) => setSponsorTier(v)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold Sponsor</SelectItem>
                    <SelectItem value="silver">Silver Sponsor</SelectItem>
                    <SelectItem value="bronze">Bronze Sponsor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Display Order</Label>
                <Input
                  type="number"
                  className="mt-1 text-xs"
                  value={sponsorDisplayOrder}
                  onChange={e => setSponsorDisplayOrder(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={sponsorActive} onCheckedChange={setSponsorActive} />
              <Label className="text-xs font-medium">Active & Visible</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSponsorDlg({ open: false })}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSaveSponsor}
              disabled={sponsorSaving}
            >
              {sponsorSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: WINNER OF MONTH */}
      {/* ============================================================ */}
      <Dialog open={womDlg} onOpenChange={setWomDlg}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Winner of the Month</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Artist Name *</Label>
              <Input className="mt-1 text-xs" value={womName} onChange={e => setWomName(e.target.value)} placeholder="e.g. Slapdee" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Award / Title *</Label>
              <Input className="mt-1 text-xs" value={womAward} onChange={e => setWomAward(e.target.value)} placeholder="e.g. Artist of the Month" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Prize</Label>
              <Input className="mt-1 text-xs" value={womPrize} onChange={e => setWomPrize(e.target.value)} placeholder="e.g. ZMW 10,000 + Studio Session" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea className="mt-1 text-xs" rows={2} value={womDesc} onChange={e => setWomDesc(e.target.value)} placeholder="Why they won..." />
            </div>
            <div>
              <Label className="text-xs font-semibold">Photo</Label>
              <Input type="file" accept="image/*" className="mt-1 text-xs" onChange={e => setWomPhoto(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWomDlg(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveWinner} disabled={womSaving}>
              {womSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
