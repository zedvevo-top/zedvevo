import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Star, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  getAllAwards, createAward, updateAward, deleteAward,
  createAwardCategory, updateAwardCategory, deleteAwardCategory,
  getAllNominees, updateNomineeStatus, setWinner,
  getAllWinnersOfMonth, upsertWinnerOfMonth, publishWinnerOfMonth,
  getWeeklyTrending, computeAndStoreWeeklyTrending,
  createNotification, uploadFile,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Award, AwardCategory, Nominee, WinnerOfMonth, WeeklyTrending } from '@/types/index';

export default function AdminAwardsPage() {
  const [awards, setAwards]     = useState<Award[]>([]);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [winners, setWinners]   = useState<WinnerOfMonth[]>([]);
  const [trending, setTrending] = useState<WeeklyTrending[]>([]);
  const [loading, setLoading]   = useState(true);
  const [trendRefreshing, setTrendRefreshing] = useState(false);

  // Award dialog
  const [awardDlg, setAwardDlg]   = useState<{ open: boolean; award?: Award }>({ open: false });
  const [awardName, setAwardName] = useState('');
  const [awardDesc, setAwardDesc] = useState('');
  const [awardYear, setAwardYear] = useState(new Date().getFullYear().toString());
  const [awardVoting, setAwardVoting] = useState(false);
  const [awardSaving, setAwardSaving] = useState(false);

  // Category dialog
  const [catDlg, setCatDlg]   = useState<{ open: boolean; category?: AwardCategory; awardId?: string }>({ open: false });
  const [catName, setCatName] = useState('');
  const [catPrize, setCatPrize] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Nominee dialog
  const [nomineeDlg, setNomineeDlg] = useState(false);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeSongTitle, setNomineeSongTitle] = useState('');
  const [nomineeCategoryId, setNomineeCategoryId] = useState('');
  const [nomineeVotes, setNomineeVotes] = useState('0');
  const [nomineePhoto, setNomineePhoto] = useState<File | null>(null);
  const [nomineeSaving, setNomineeSaving] = useState(false);

  // Winner of month dialog
  const [womDlg, setWomDlg]   = useState(false);
  const [womName, setWomName] = useState('');
  const [womAward, setWomAward] = useState('');
  const [womPrize, setWomPrize] = useState('');
  const [womDesc, setWomDesc] = useState('');
  const [womMonth, setWomMonth] = useState(new Date().getMonth() + 1);
  const [womYear2, setWomYear2] = useState(new Date().getFullYear());
  const [womPhoto, setWomPhoto] = useState<File | null>(null);
  const [womSaving, setWomSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAllAwards(), getAllNominees(), getAllWinnersOfMonth(), getWeeklyTrending()])
      .then(([a, n, w, t]) => { setAwards(a); setNominees(n); setWinners(w); setTrending(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Award CRUD
  const openAwardDlg = (award?: Award) => {
    setAwardName(award?.name || ''); setAwardDesc(award?.description || '');
    setAwardYear(String(award?.year || new Date().getFullYear())); setAwardVoting(award?.voting_open || false);
    setAwardDlg({ open: true, award });
  };
  const handleSaveAward = async () => {
    if (!awardName) { toast.error('Award name required'); return; }
    setAwardSaving(true);
    try {
      const payload = { name: awardName, description: awardDesc || undefined, year: parseInt(awardYear), voting_open: awardVoting, is_active: true };
      if (awardDlg.award) { await updateAward(awardDlg.award.id, payload); }
      else { await createAward(payload); }
      setAwards(await getAllAwards());
      toast.success(`Award ${awardDlg.award ? 'updated' : 'created'}`);
      setAwardDlg({ open: false });
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setAwardSaving(false); }
  };

  // Category CRUD
  const openCatDlg = (awardId: string, cat?: AwardCategory) => {
    setCatName(cat?.name || ''); setCatPrize(cat?.grand_prize || '');
    setCatDlg({ open: true, category: cat, awardId });
  };
  const handleSaveCat = async () => {
    if (!catName) { toast.error('Category name required'); return; }
    setCatSaving(true);
    try {
      const payload = { name: catName, grand_prize: catPrize || undefined, is_active: true, award_id: catDlg.awardId! };
      if (catDlg.category) { await updateAwardCategory(catDlg.category.id, payload); }
      else { await createAwardCategory(payload); }
      setAwards(await getAllAwards());
      toast.success(`Category ${catDlg.category ? 'updated' : 'created'}`);
      setCatDlg({ open: false });
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setCatSaving(false); }
  };

  // Winner of month
  const handleSaveNominee = async () => {
    if (!nomineeName || !nomineeCategoryId) { toast.error('Fill required fields'); return; }
    setNomineeSaving(true);
    try {
      let photoUrl = '';
      if (nomineePhoto) {
        const timestamp = new Date().getTime();
        const ext = nomineePhoto.name.split('.').pop() || 'jpg';
        const path = `admin_${timestamp}.${ext}`;
        const { uploadFile } = await import('@/lib/api');
        photoUrl = await uploadFile('nominees', path, nomineePhoto);
      }
      const { supabase } = await import('@/db/supabase');
      const { error } = await supabase.from('nominees').insert({
        name: nomineeName,
        song_title: nomineeSongTitle.trim() || null,
        category_id: nomineeCategoryId,
        photo_url: photoUrl || null,
        total_votes: parseInt(nomineeVotes) || 0,
        registration_status: 'completed',
        nomination_status: 'approved',
      });
      if (error) throw error;
      
      const { getAllNominees } = await import('@/lib/api');
      setNominees(await getAllNominees());
      toast.success('Nominee added');
      setNomineeDlg(false);
      setNomineeName('');
      setNomineeSongTitle('');
      setNomineeCategoryId('');
      setNomineeVotes('0');
      setNomineePhoto(null);
    } catch(err: any) { toast.error(err.message || 'Failed to add nominee'); }
    finally { setNomineeSaving(false); }
  };

  const handleSaveWinner = async () => {
    if (!womName || !womAward) { toast.error('Artist name and award required'); return; }
    setWomSaving(true);
    try {
      let photoUrl: string | undefined;
      if (womPhoto) {
        photoUrl = await uploadFile('thumbnails', `wom_${Date.now()}.${womPhoto.name.split('.').pop()}`, womPhoto);
      }
      await upsertWinnerOfMonth({ artist_name: womName, award: womAward, prize: womPrize || undefined, description: womDesc || undefined, month: womMonth, year: womYear2, photo_url: photoUrl, is_published: false });
      setWinners(await getAllWinnersOfMonth());
      toast.success('Winner saved (not yet published)');
      setWomDlg(false);
    } catch { toast.error('Failed to save winner'); }
    finally { setWomSaving(false); }
  };

  const handlePublishWinner = async (id: string) => {
    await publishWinnerOfMonth(id);
    await createNotification({ title: '⭐ Winner of the Month Announced!', message: "Check out this month's winner on the Awards page.", type: 'success', notification_type: 'winner_of_month', link: '/awards' });
    setWinners(await getAllWinnersOfMonth());
    toast.success('Winner published and users notified');
  };

  const handleRefreshTrending = async () => {
    setTrendRefreshing(true);
    try { await computeAndStoreWeeklyTrending(); setTrending(await getWeeklyTrending()); toast.success('Trending refreshed'); }
    catch { toast.error('Failed to refresh trending'); }
    finally { setTrendRefreshing(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Awards & Trending</h1>
        <p className="text-sm text-muted-foreground">{awards.length} awards · {nominees.length} nominees</p>
      </div>

      <Tabs defaultValue="awards">
        <TabsList className="h-8">
          <TabsTrigger value="awards"   className="text-xs">Awards</TabsTrigger>
          <TabsTrigger value="nominees" className="text-xs">Nominees ({nominees.length})</TabsTrigger>
          <TabsTrigger value="winners"  className="text-xs">Winners of Month</TabsTrigger>
          <TabsTrigger value="trending" className="text-xs">Trending</TabsTrigger>
        </TabsList>

        {/* Awards tab */}
        <TabsContent value="awards" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs" onClick={() => openAwardDlg()}>
              <Plus className="h-3.5 w-3.5" />Add Award
            </Button>
          </div>
          {loading ? <Skeleton className="h-24 w-full" /> : awards.map(award => (
            <Card key={award.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm">{award.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{award.year} · {award.voting_open ? 'Voting Open' : 'Voting Closed'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openAwardDlg(award)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={async () => { if (!confirm('Delete award?')) return; await deleteAward(award.id); setAwards(p => p.filter(a => a.id !== award.id)); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Categories ({award.award_categories?.length || 0})</p>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => openCatDlg(award.id)}>
                    <Plus className="h-3 w-3" />Category
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {award.award_categories?.map(cat => (
                    <div key={cat.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                      <span className="text-[11px]">{cat.name}</span>
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => openCatDlg(award.id, cat)}>
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button className="text-destructive/70 hover:text-destructive"
                        onClick={async () => { if (!confirm('Delete category?')) return; await deleteAwardCategory(cat.id); setAwards(await getAllAwards()); }}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Nominees tab */}
        <TabsContent value="nominees" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
              onClick={() => { setNomineeName(''); setNomineeCategoryId(''); setNomineePhoto(null); setNomineeDlg(true); }}>
              <Plus className="h-3.5 w-3.5" />Add Nominee
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40">
                <tr>{['Name', 'Category', 'Status', 'Votes', 'Submitted', 'Actions'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                : nominees.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-muted-foreground text-xs">No nominees yet</td></tr>
                : nominees.map(nom => (
                  <tr key={nom.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                      <div className="flex items-center gap-2">
                        {nom.photo_url && <img src={nom.photo_url} alt={nom.name} className="h-6 w-6 rounded-full object-cover shrink-0" />}
                        {nom.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{(nom.award_categories as { name?: string } | null)?.name ?? '—'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge variant={nom.nomination_status === 'approved' ? 'default' : nom.nomination_status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">{nom.nomination_status}</Badge>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{nom.total_votes ?? 0}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(nom.created_at)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        {nom.nomination_status === 'pending_review' && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Approve"
                              onClick={async () => {
                                await updateNomineeStatus(nom.id, 'approved');
                                await createNotification({ user_id: nom.user_id, title: '✅ Nomination Approved', message: `Your nomination for "${nom.name}" has been approved!`, type: 'success', notification_type: 'nomination_approved' });
                                setNominees(p => p.map(n => n.id === nom.id ? { ...n, nomination_status: 'approved' } : n));
                                toast.success('Approved');
                              }}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Reject"
                              onClick={async () => {
                                await updateNomineeStatus(nom.id, 'rejected');
                                await createNotification({ user_id: nom.user_id, title: '❌ Nomination Rejected', message: `Your nomination for "${nom.name}" was not approved.`, type: 'error', notification_type: 'nomination_rejected' });
                                setNominees(p => p.map(n => n.id === nom.id ? { ...n, nomination_status: 'rejected' } : n));
                                toast.success('Rejected');
                              }}><XCircle className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                        {nom.nomination_status === 'approved' && (
                          <Button size="sm" className="h-6 text-[10px] px-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                            onClick={async () => {
                              await setWinner(nom.id);
                              await createNotification({ title: '🏆 Award Winner Announced!', message: `${nom.name} has been declared a winner!`, type: 'success', notification_type: 'award_winner', link: '/awards' });
                              setNominees(p => p.map(n => n.id === nom.id ? { ...n, nomination_status: 'winner', is_winner: true } : n));
                              toast.success('Winner set');
                            }}>Set Winner</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Winners of Month tab */}
        <TabsContent value="winners" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
              onClick={() => { setWomName(''); setWomAward(''); setWomPrize(''); setWomDesc(''); setWomPhoto(null); setWomDlg(true); }}>
              <Plus className="h-3.5 w-3.5" />Add Winner
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {winners.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center col-span-full">No winners yet</p>
            : winners.map(w => (
              <Card key={w.id} className={w.is_published ? 'border-accent/40' : ''}>
                <CardContent className="flex gap-3 py-3">
                  <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0">
                    {w.photo_url ? <img src={w.photo_url} alt={w.artist_name} className="w-full h-full object-cover" /> : <Star className="h-6 w-6 text-muted-foreground m-auto mt-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{w.artist_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{w.award}</p>
                    <p className="text-xs text-muted-foreground">{new Date(w.year, w.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                    <div className="mt-1.5">
                      {!w.is_published
                        ? <Button size="sm" className="h-6 text-[10px] px-2 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => handlePublishWinner(w.id)}>Publish</Button>
                        : <Badge variant="default" className="text-[10px]">Published</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Trending tab */}
        <TabsContent value="trending" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{trending.length} entries</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={handleRefreshTrending} disabled={trendRefreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${trendRefreshing ? 'animate-spin' : ''}`} />Recalculate
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/40">
                <tr>{['Rank', 'Title', 'Artist', 'Type', 'Category', 'Value'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {trending.slice(0, 50).map(t => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-2.5 px-3 whitespace-nowrap font-bold text-accent">#{t.rank}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap max-w-[160px] truncate font-medium">{t.title}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{t.artist_name}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap"><Badge variant="outline" className="text-[10px] capitalize">{t.content_type}</Badge></td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs capitalize">{t.category.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{t.metric_value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Award dialog */}
      <Dialog open={awardDlg.open} onOpenChange={o => setAwardDlg({ open: o })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>{awardDlg.award ? 'Edit' : 'New'} Award</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div><Label>Name *</Label><Input className="mt-1" value={awardName} onChange={e => setAwardName(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea className="mt-1 resize-none" rows={2} value={awardDesc} onChange={e => setAwardDesc(e.target.value)} /></div>
            <div><Label>Year</Label><Input className="mt-1" type="number" value={awardYear} onChange={e => setAwardYear(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={awardVoting} onCheckedChange={setAwardVoting} /><Label>Voting Open</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDlg({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveAward} disabled={awardSaving}>
              {awardSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={catDlg.open} onOpenChange={o => setCatDlg({ open: o })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>{catDlg.category ? 'Edit' : 'New'} Category</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div><Label>Name *</Label><Input className="mt-1" value={catName} onChange={e => setCatName(e.target.value)} /></div>
            <div><Label>Grand Prize</Label><Input className="mt-1" value={catPrize} onChange={e => setCatPrize(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDlg({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveCat} disabled={catSaving}>
              {catSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nominee Dialog */}
      <Dialog open={nomineeDlg} onOpenChange={setNomineeDlg}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>Add Nominee</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Nominee Name / Artist *</Label>
              <Input className="mt-1" placeholder="Artist or Band name" value={nomineeName} onChange={e => setNomineeName(e.target.value)} />
            </div>
            <div>
              <Label>Nominated Song / Work (Optional)</Label>
              <Input className="mt-1" placeholder="e.g. Song Title or Album" value={nomineeSongTitle} onChange={e => setNomineeSongTitle(e.target.value)} />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={nomineeCategoryId} onValueChange={setNomineeCategoryId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {awards.map(award => (
                    (award.award_categories || []).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {award.name} — {cat.name}
                      </SelectItem>
                    ))
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Initial Votes</Label>
              <Input className="mt-1" type="number" min={0} value={nomineeVotes} onChange={e => setNomineeVotes(e.target.value)} />
            </div>
            <div>
              <Label>Photo (Optional)</Label>
              <Input type="file" accept="image/*" className="mt-1" onChange={e => {
                if (e.target.files && e.target.files[0]) setNomineePhoto(e.target.files[0]);
              }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNomineeDlg(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveNominee} disabled={nomineeSaving}>
              {nomineeSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Nominee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Winner of month dialog */}
      <Dialog open={womDlg} onOpenChange={setWomDlg}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>Add Winner of the Month</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div><Label>Artist Name *</Label><Input className="mt-1" value={womName} onChange={e => setWomName(e.target.value)} /></div>
            <div><Label>Award *</Label><Input className="mt-1" value={womAward} onChange={e => setWomAward(e.target.value)} /></div>
            <div><Label>Prize</Label><Input className="mt-1" value={womPrize} onChange={e => setWomPrize(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea className="mt-1 resize-none" rows={2} value={womDesc} onChange={e => setWomDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Month</Label><Input className="mt-1" type="number" min={1} max={12} value={womMonth} onChange={e => setWomMonth(Number(e.target.value))} /></div>
              <div><Label>Year</Label><Input className="mt-1" type="number" value={womYear2} onChange={e => setWomYear2(Number(e.target.value))} /></div>
            </div>
            <div><Label>Photo</Label><Input className="mt-1" type="file" accept="image/*" onChange={e => setWomPhoto(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWomDlg(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveWinner} disabled={womSaving}>
              {womSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Winner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
