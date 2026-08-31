import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, Share2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Award, Nominee } from '@/types/index';
import { getActiveAwards, getNomineesByCategory, getSettings, uploadFile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { generateIdempotencyKey, formatCurrency } from '@/lib/utils';
import BackToHome from '@/components/common/BackToHome';
import PageMeta from '@/components/common/PageMeta';
import ShareSheet from '@/components/common/ShareSheet';

export default function AwardsPage() {
  const { user } = useAuth();
  const [awards, setAwards] = useState<Award[]>([]);
  const [nominees, setNominees] = useState<Record<string, Nominee[]>>({});
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [selectedAward, setSelectedAward] = useState<Award | null>(null);
  const [nomDialog, setNomDialog] = useState(false);
  const [nomAwardId, setNomAwardId] = useState('');
  const [nomCategoryId, setNomCategoryId] = useState('');
  const [nomName, setNomName] = useState('');
  const [nomBio, setNomBio] = useState('');
  const [nomSongTitle, setNomSongTitle] = useState('');
  const [nomSongUrl, setNomSongUrl] = useState('');
  const [nomVideoUrl, setNomVideoUrl] = useState('');
  const [nomPhoto, setNomPhoto] = useState<File | null>(null);
  const [nomPhone, setNomPhone] = useState('');
  const [nomPayMethod, setNomPayMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [nomLoading, setNomLoading] = useState(false);
  const [voteDialog, setVoteDialog] = useState(false);
  const [voteNominee, setVoteNominee] = useState<Nominee | null>(null);
  const [voteAmount, setVoteAmount] = useState('');
  const [votePhone, setVotePhone] = useState('');
  const [votePayMethod, setVotePayMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [voteLoading, setVoteLoading] = useState(false);
  const [sharedNominee, setSharedNominee] = useState<Nominee | null>(null);

  const loadNominees = useCallback(async (award: Award) => {
    const entries = await Promise.all((award.award_categories || []).map(async category => [category.id, await getNomineesByCategory(category.id)] as const));
    setNominees(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    Promise.all([getActiveAwards(), getSettings()])
      .then(([activeAwards, awardSettings]) => {
        setAwards(activeAwards);
        setSettings(awardSettings);
        setSelectedAward(activeAwards[0] ?? null);
        if (activeAwards[0]) void loadNominees(activeAwards[0]);
      })
      .catch(() => toast.error('Unable to load awards right now.'))
      .finally(() => setLoading(false));
  }, [loadNominees]);

  useEffect(() => {
    if (!selectedAward) return;
    void loadNominees(selectedAward);
  }, [selectedAward, loadNominees]);

  useEffect(() => {
    const channel = supabase.channel('awards-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nominees' }, () => selectedAward && void loadNominees(selectedAward))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedAward, loadNominees]);

  const allCategories = useMemo(() => awards.flatMap(award => (award.award_categories || []).map(category => ({ ...category, awardId: award.id }))), [awards]);
  const nominationCategories = useMemo(() => allCategories.filter(category => category.awardId === nomAwardId), [allCategories, nomAwardId]);
  const nomineeFee = parseFloat(settings.nominee_fee || '25');
  const voteMin = parseFloat(settings.vote_min_amount || '5');
  const sharedNomineeId = new URLSearchParams(window.location.search).get('nominee');
  const sharedLinkNominee = Object.values(nominees).flat().find(nominee => nominee.id === sharedNomineeId);
  const metaNominee = sharedNominee ?? sharedLinkNominee ?? nominees[selectedAward?.award_categories?.[0]?.id ?? '']?.[0];
  const metaTitle = metaNominee ? `Vote for ${metaNominee.name} | ZedVevo Awards` : 'ZedVevo Awards';
  const metaDescription = metaNominee ? `Support ${metaNominee.name}${metaNominee.song_title ? ` — ${metaNominee.song_title}` : ''} in the ZedVevo Awards.` : 'Vote for your favourite ZedVevo Awards nominees.';

  const resetNomination = () => {
    setNomName(''); setNomBio(''); setNomSongTitle(''); setNomSongUrl(''); setNomVideoUrl(''); setNomPhoto(null); setNomPhone(''); setNomCategoryId(''); setNomAwardId('');
  };

  const handleNominate = async () => {
    if (!user) return toast.error('Sign in to register as a nominee');
    if (!nomAwardId || !nomCategoryId || !nomName.trim() || !nomBio.trim() || !nomPhoto) return toast.error('Complete the artist details and add a photo');
    if (nomPayMethod === 'mobile_money' && !nomPhone.trim()) return toast.error('Enter your phone number');
    if (!nomPhoto.type.startsWith('image/')) return toast.error('Please choose an image file');
    setNomLoading(true);
    try {
      const extension = nomPhoto.name.split('.').pop() || 'jpg';
      const photoUrl = await uploadFile('nominees', `${user.id}/${Date.now()}.${extension}`, nomPhoto);
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('lipila-payment', {
        headers: sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
        body: {
          amount: nomineeFee, payment_method: nomPayMethod, phone_number: nomPayMethod === 'mobile_money' ? nomPhone : undefined,
          description: `Nominee registration: ${nomName.trim()}`, idempotency_key: generateIdempotencyKey(), payment_type: 'nominee_registration',
          metadata: { award_id: nomAwardId, category_id: nomCategoryId, nominee_name: nomName.trim(), bio: nomBio.trim(), photo_url: photoUrl, song_title: nomSongTitle.trim() || undefined, song_url: nomSongUrl.trim() || undefined, video_url: nomVideoUrl.trim() || undefined },
        },
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      toast.success('Payment request sent. Your nomination will appear automatically after payment succeeds.');
      setNomDialog(false); resetNomination();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the registration payment');
    } finally { setNomLoading(false); }
  };

  const handleVote = async () => {
    if (!user) return toast.error('Sign in to vote');
    if (!voteNominee) return;
    const amount = parseFloat(voteAmount);
    if (!Number.isFinite(amount) || amount < voteMin) return toast.error(`Minimum vote amount is ${formatCurrency(voteMin)}`);
    if (votePayMethod === 'mobile_money' && !votePhone.trim()) return toast.error('Enter your phone number');
    setVoteLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('lipila-payment', {
        headers: sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
        body: { amount, payment_method: votePayMethod, phone_number: votePayMethod === 'mobile_money' ? votePhone : undefined, description: `Vote for ${voteNominee.name}`, idempotency_key: generateIdempotencyKey(), payment_type: 'vote', metadata: { nominee_id: voteNominee.id, category_id: voteNominee.category_id, vote_count: Math.floor(amount / voteMin) } },
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      toast.success(`Payment request sent for ${Math.floor(amount / voteMin)} vote(s). The live total updates after payment succeeds.`);
      setVoteDialog(false); setVoteAmount(''); setVotePhone('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the voting payment');
    } finally { setVoteLoading(false); }
  };

  if (loading) return <div className="min-h-screen pt-20 pb-24"><div className="max-w-7xl mx-auto px-4 py-6"><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-64 mb-8" /><Skeleton className="h-80 w-full rounded-xl" /></div></div>;

  return <div className="min-h-screen pt-20 pb-24 lg:pb-6">
    <PageMeta title={metaTitle} description={metaDescription} image={metaNominee?.photo_url} url={window.location.href} />
    <div className="max-w-7xl mx-auto px-4">
      <BackToHome />
      <div className="py-6 border-b border-border mb-6"><h1 className="text-2xl font-bold flex items-center gap-2 mb-1"><Trophy className="h-6 w-6 text-accent" /> ZedVevo Awards</h1><p className="text-sm text-muted-foreground">Vote for your favourite nominees</p></div>
      {awards.length === 0 ? <div className="text-center py-20"><Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" /><h2 className="text-lg font-semibold mb-2">No Active Awards</h2><p className="text-sm text-muted-foreground">Awards will appear here when they go live.</p></div> : <>
        <div className="flex gap-2 overflow-x-auto scroll-row pb-3 mb-6">{awards.map(award => <button key={award.id} onClick={() => setSelectedAward(award)} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedAward?.id === award.id ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground'}`}>{award.name}</button>)}</div>
        {selectedAward && <div><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6"><div><h2 className="text-xl font-bold">{selectedAward.name}</h2><p className="text-sm text-muted-foreground">{selectedAward.description}</p></div><div className="flex gap-2 shrink-0"><Badge variant={selectedAward.voting_open ? 'default' : 'secondary'} className="text-xs">{selectedAward.voting_open ? 'Voting Open' : 'Voting Closed'}</Badge>{user && <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setNomDialog(true)}>Register as Nominee ({formatCurrency(nomineeFee)})</Button>}</div></div>
          <div className="space-y-8">{(selectedAward.award_categories || []).map(category => { const categoryNominees = nominees[category.id] || []; return <section key={category.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"><div className="bg-muted/50 px-5 py-4 flex items-center justify-between"><div><h3 className="font-semibold">{category.name}</h3>{category.grand_prize && <p className="text-xs text-accent mt-1">Prize: {category.grand_prize}</p>}</div><span className="text-xs text-muted-foreground">{categoryNominees.length} nominees</span></div>{categoryNominees.length === 0 ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">No nominees yet in this category.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">{categoryNominees.map(nominee => <article key={nominee.id} className="flex gap-3 rounded-xl border border-border bg-background p-3 shadow-sm transition-shadow hover:shadow-md"><div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">{nominee.photo_url ? <img src={nominee.photo_url} alt={nominee.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">{nominee.name[0]}</div>}</div><div className="min-w-0 flex-1"><div className="flex gap-2 items-start"><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{nominee.name}</p>{nominee.song_title && <p className="text-xs text-muted-foreground truncate">{nominee.song_title}</p>}</div>{nominee.is_winner && <Badge className="text-[10px] bg-accent text-accent-foreground">Winner</Badge>}</div><div className="mt-3 flex items-center justify-between gap-2"><div><p className="text-base font-bold leading-none">{(nominee.total_votes ?? 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground mt-1">verified votes</p></div><div className="flex gap-1.5"><Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Share ${nominee.name}`} onClick={() => setSharedNominee(nominee)}><Share2 className="h-3.5 w-3.5" /></Button>{selectedAward.voting_open && <Button size="sm" className="h-8 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => user ? (setVoteNominee(nominee), setVoteDialog(true)) : toast.error('Sign in to vote')}>Vote</Button>}</div></div></div></article>)}</div>}</section>; })}</div>
        </div>}
      </>}
    </div>
    <Dialog open={nomDialog} onOpenChange={open => { setNomDialog(open); if (!open) resetNomination(); }}><DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg"><DialogHeader><DialogTitle>Register as Nominee</DialogTitle><DialogDescription>Submit your artist details and pay {formatCurrency(nomineeFee)}. Successful payments are approved automatically.</DialogDescription></DialogHeader><div className="space-y-3 py-2"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Award *</Label><Select value={nomAwardId} onValueChange={value => { setNomAwardId(value); setNomCategoryId(''); }}><SelectTrigger className="mt-1"><SelectValue placeholder="Select award" /></SelectTrigger><SelectContent>{awards.map(award => <SelectItem key={award.id} value={award.id}>{award.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Category *</Label><Select value={nomCategoryId} onValueChange={setNomCategoryId} disabled={!nomAwardId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{nominationCategories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Artist name *</Label><Input className="mt-1" value={nomName} onChange={event => setNomName(event.target.value)} /></div><div><Label>Artist bio *</Label><Textarea className="mt-1 resize-none" rows={3} value={nomBio} onChange={event => setNomBio(event.target.value)} placeholder="Tell voters about the artist" /></div><div><Label>Artist photo *</Label><div className="mt-1 flex items-center gap-2"><Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => setNomPhoto(event.target.files?.[0] ?? null)} />{nomPhoto && <ImagePlus className="h-4 w-4 text-accent shrink-0" />}</div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Song title</Label><Input className="mt-1" value={nomSongTitle} onChange={event => setNomSongTitle(event.target.value)} /></div><div><Label>Song link</Label><Input className="mt-1" type="url" value={nomSongUrl} onChange={event => setNomSongUrl(event.target.value)} /></div></div><div><Label>Video link</Label><Input className="mt-1" type="url" value={nomVideoUrl} onChange={event => setNomVideoUrl(event.target.value)} /></div><div><Label>Payment method *</Label><Select value={nomPayMethod} onValueChange={value => setNomPayMethod(value as 'mobile_money' | 'card')}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mobile_money">Mobile Money</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select></div>{nomPayMethod === 'mobile_money' && <div><Label>Phone number *</Label><Input className="mt-1" value={nomPhone} onChange={event => setNomPhone(event.target.value)} placeholder="e.g. 0977123456" /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setNomDialog(false)}>Cancel</Button><Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleNominate} disabled={nomLoading}>{nomLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pay & Register</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={voteDialog} onOpenChange={setVoteDialog}><DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg"><DialogHeader><DialogTitle>Vote for {voteNominee?.name}</DialogTitle><DialogDescription>Minimum vote: {formatCurrency(voteMin)} = 1 vote. Totals only change after successful payment.</DialogDescription></DialogHeader><div className="space-y-3 py-2"><div><Label>Vote amount (ZMW) *</Label><Input className="mt-1" type="number" min={voteMin} step={voteMin} value={voteAmount} onChange={event => setVoteAmount(event.target.value)} placeholder={`Min. ${formatCurrency(voteMin)}`} />{Number(voteAmount) >= voteMin && <p className="text-xs text-muted-foreground mt-1">= {Math.floor(Number(voteAmount) / voteMin)} vote(s)</p>}</div><div><Label>Payment method *</Label><Select value={votePayMethod} onValueChange={value => setVotePayMethod(value as 'mobile_money' | 'card')}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mobile_money">Mobile Money</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select></div>{votePayMethod === 'mobile_money' && <div><Label>Phone number *</Label><Input className="mt-1" value={votePhone} onChange={event => setVotePhone(event.target.value)} placeholder="e.g. 0977123456" /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setVoteDialog(false)}>Cancel</Button><Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleVote} disabled={voteLoading}>{voteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pay & Vote</Button></DialogFooter></DialogContent></Dialog>
    {sharedNominee && <ShareSheet open onClose={() => setSharedNominee(null)} url={`${window.location.origin}/awards?nominee=${sharedNominee.id}`} title={`Vote for ${sharedNominee.name}`} text={`Support ${sharedNominee.name} in the ZedVevo Awards.`} thumbnailUrl={sharedNominee.photo_url} />}
  </div>;
}
