import BackToHome from '@/components/common/BackToHome';
import { useState, useEffect, useMemo } from 'react';
import { Trophy, Loader2, AlertCircle, HelpCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Award, Nominee } from '@/types/index';
import { getActiveAwards, getNomineesByCategory, getSettings, uploadFile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { generateIdempotencyKey, formatCurrency } from '@/lib/utils';
import VoteDialog from '@/components/awards/VoteDialog';
import ShareSheet from '@/components/common/ShareSheet';
import AdBanner from '@/components/ads/AdBanner';
import { processUnifiedPayment } from '@/lib/paymentProcessor';

export default function AwardsPage() {
  const { user } = useAuth();
  const [awards, setAwards] = useState<Award[]>([]);
  const [nominees, setNominees] = useState<Record<string, Nominee[]>>({});
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [selectedAward, setSelectedAward] = useState<Award | null>(null);

  // Nomination dialog
  const [nomDialog, setNomDialog] = useState(false);
  const [nomAwardId, setNomAwardId] = useState('');
  const [nomCategoryId, setNomCategoryId] = useState('');
  const [nomName, setNomName] = useState('');
  const [nomPhone, setNomPhone] = useState('');
  const [nomPhoto, setNomPhoto] = useState<File | null>(null);
  const [nomPayMethod, setNomPayMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [nomLoading, setNomLoading] = useState(false);

  // Vote dialog
  const [voteDialog, setVoteDialog] = useState(false);
  const [voteNominee, setVoteNominee] = useState<Nominee | null>(null);

  // Share sheet
  const [shareData, setShareData] = useState<{ open: boolean; url: string; title: string; thumbnailUrl?: string }>({
    open: false,
    url: '',
    title: '',
  });

  useEffect(() => {
    Promise.all([getActiveAwards(), getSettings()])
      .then(([aw, s]) => {
        setAwards(aw);
        setSettings(s);
        if (aw.length > 0) setSelectedAward(aw[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAward) return;
    const cats = selectedAward.award_categories || [];
    cats.forEach(async cat => {
      const data = await getNomineesByCategory(cat.id);
      setNominees(prev => ({ ...prev, [cat.id]: data }));
    });
  }, [selectedAward]);

  // Realtime subscription for votes updating live
  useEffect(() => {
    const channel = supabase
      .channel('realtime_awards_nominees')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nominees' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updatedNominee = payload.new as Nominee;
            setNominees((prev) => {
              const catId = updatedNominee.category_id;
              const list = prev[catId] || [];
              const exists = list.some((n) => n.id === updatedNominee.id);
              const updatedList = exists
                ? list.map((n) => (n.id === updatedNominee.id ? updatedNominee : n))
                : [...list, updatedNominee];
              // Sort descending by total_votes
              updatedList.sort((a, b) => b.total_votes - a.total_votes);
              return { ...prev, [catId]: updatedList };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Flat list of ALL categories across ALL awards — used in the nominate dialog
  const allCategories = useMemo(() =>
    awards.flatMap(aw =>
      (aw.award_categories || []).map(cat => ({ ...cat, awardName: aw.name, awardId: aw.id }))
    ),
    [awards]
  );

  // When the user picks an award in the nom dialog, reset category
  const handleNomAwardChange = (awardId: string) => {
    setNomAwardId(awardId);
    setNomCategoryId('');
  };

  // Categories for the currently selected award in the dialog
  const nomCategories = useMemo(
    () => allCategories.filter(c => c.awardId === nomAwardId),
    [allCategories, nomAwardId]
  );

  const nomineeFee = parseFloat(settings.nominee_fee || '25');
  const voteMin    = parseFloat(settings.vote_min_amount || '5');

  const handleNominate = async () => {
    if (!nomAwardId)    { toast.error('Please select an award'); return; }
    if (!nomCategoryId) { toast.error('Please select a category'); return; }
    if (!nomName)       { toast.error('Please enter your name'); return; }
    if (nomPayMethod === 'mobile_money' && !nomPhone) { toast.error('Enter your phone number'); return; }
    setNomLoading(true);
    try {
      let photoUrl = '';
      if (nomPhoto) {
        const timestamp = new Date().getTime();
        const ext = nomPhoto.name.split('.').pop() || 'jpg';
        const uId = user?.id || 'guest';
        const path = `${uId}_${timestamp}.${ext}`;
        photoUrl = await uploadFile('nominees', path, nomPhoto);
      }

      // 1. First insert pending nominee record
      const { data: newNominee, error: nomInsertErr } = await supabase
        .from('nominees')
        .insert({
          category_id: nomCategoryId,
          name: nomName,
          photo_url: photoUrl || null,
          total_votes: 0,
          registration_status: 'pending',
          nomination_status: 'pending',
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (nomInsertErr || !newNominee) {
        toast.error('Could not create nominee registration record');
        return;
      }

      // 2. Process payment
      const result = await processUnifiedPayment({
        amount: nomineeFee,
        payment_method: nomPayMethod,
        phone_number: nomPayMethod === 'mobile_money' ? nomPhone.trim() : undefined,
        description: `Nominee registration: ${nomName}`,
        payment_type: 'nominee_registration',
        user_id: user?.id || null,
        metadata: {
          nominee_id: newNominee.id,
          award_id: nomAwardId,
          category_id: nomCategoryId,
          nominee_name: nomName,
          user_id: user?.id || null,
          photo_url: photoUrl
        }
      });

      if (!result.success) {
        // Automatically set to failed & rejected
        await supabase
          .from('nominees')
          .update({
            registration_status: 'failed',
            nomination_status: 'rejected'
          })
          .eq('id', newNominee.id);

        toast.error(result.error || 'Payment failed — Nominee registration rejected.');
        return;
      }

      // 3. Automatically approve nominee when payment is successful
      await supabase
        .from('nominees')
        .update({
          registration_status: 'completed',
          nomination_status: 'approved'
        })
        .eq('id', newNominee.id);

      toast.success(`Congratulations! ${nomName} is now automatically approved as an official nominee.`);
      setNomDialog(false);
      setNomName(''); setNomPhone(''); setNomCategoryId(''); setNomAwardId(''); setNomPhoto(null);

      // Refresh list
      loadAwards();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to process nominee payment');
    } finally { setNomLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen pt-20 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-20 pb-24 lg:pb-6">
      <div className="max-w-7xl mx-auto px-4">
        <BackToHome />
        <div className="py-6 border-b border-border mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
            <Trophy className="h-6 w-6 text-accent" /> ZedVevo Awards
          </h1>
          <p className="text-sm text-muted-foreground">Vote for your favourite nominees</p>
        </div>

        {awards.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold mb-2">No Active Awards</h2>
            <p className="text-sm text-muted-foreground">Awards will appear here when they go live.</p>
          </div>
        ) : (
          <>
            {/* Award tabs */}
            <div className="flex gap-2 overflow-x-auto scroll-row pb-3 mb-6">
              {awards.map(award => (
                <button
                  key={award.id}
                  onClick={() => setSelectedAward(award)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedAward?.id === award.id
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {award.name}
                </button>
              ))}
            </div>

            {selectedAward && (
              <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedAward.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedAward.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="flex items-center gap-1.5" onClick={() => toast.info('For support, email support@example.com or call +260977123456')}>
                      <HelpCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Help</span>
                    </Button>
                    <Badge variant={selectedAward.voting_open ? 'default' : 'secondary'} className="text-xs">
                      {selectedAward.voting_open ? 'Voting Open' : 'Voting Closed'}
                    </Badge>
                    <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      onClick={() => setNomDialog(true)}>
                      Register as Nominee ({formatCurrency(nomineeFee)})
                    </Button>
                  </div>
                </div>

                {/* Native Sponsor Ad */}
                <AdBanner position="awards" format="leaderboard" />

                {/* Categories */}
                <div className="space-y-8">
                  {(selectedAward.award_categories || []).map(cat => {
                    const catNominees = nominees[cat.id] || [];
                    return (
                      <div key={cat.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-sm">{cat.name}</h3>
                            {cat.grand_prize && (
                              <p className="text-xs text-accent mt-0.5">Prize: {cat.grand_prize}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{catNominees.length} nominees</span>
                        </div>
                        {catNominees.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            No nominees yet in this category.
                          </div>
                        ) : (
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {catNominees.map(nominee => (
                              <div key={nominee.id} className="relative group bg-card border border-border rounded-xl overflow-hidden hover:border-accent transition-all flex flex-col">
                                <div className="aspect-square bg-muted relative shrink-0">
                                  {nominee.photo_url ? (
                                    <img src={nominee.photo_url} alt={nominee.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/30">{nominee.name[0]}</div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                  {nominee.is_winner && (
                                    <div className="absolute top-2 right-2">
                                      <Badge className="bg-accent text-accent-foreground border-none">Winner</Badge>
                                    </div>
                                  )}
                                  <div className="absolute bottom-3 left-3 right-3 text-white">
                                    <p className="font-semibold text-sm truncate">{nominee.name}</p>
                                    {nominee.song_title && <p className="text-xs text-white/70 truncate">{nominee.song_title}</p>}
                                  </div>
                                </div>
                                <div className="p-3 flex items-center justify-between flex-1 bg-card">
                                  <div>
                                    <p className="text-sm font-semibold">{nominee.total_votes.toLocaleString()}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Votes</p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      title="Share Nominee Link"
                                      onClick={() =>
                                        setShareData({
                                          open: true,
                                          url: `${window.location.origin}/nominee/${nominee.id}`,
                                          title: `Vote for ${nominee.name} - ZedVevo Awards`,
                                          thumbnailUrl: nominee.photo_url || undefined,
                                        })
                                      }
                                    >
                                      <Share2 className="h-3.5 w-3.5" />
                                    </Button>
                                    {selectedAward.voting_open && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="text-xs h-7 bg-accent text-accent-foreground hover:bg-accent/90 px-4"
                                        onClick={() => {
                                          setVoteNominee(nominee);
                                          setVoteDialog(true);
                                        }}
                                      >
                                        Vote
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Nomination Dialog — shows ALL awards + ALL their categories */}
      <Dialog open={nomDialog} onOpenChange={(open) => {
        setNomDialog(open);
        if (!open) { setNomName(''); setNomPhone(''); setNomCategoryId(''); setNomAwardId(''); }
      }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register as Nominee</DialogTitle>
            <DialogDescription>
              Registration fee: <strong>{formatCurrency(nomineeFee)}</strong>. Your nomination will be confirmed after successful payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Step 1 — pick an award */}
            <div>
              <Label>Award *</Label>
              <Select value={nomAwardId} onValueChange={handleNomAwardChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select award" />
                </SelectTrigger>
                <SelectContent>
                  {awards.map(aw => (
                    <SelectItem key={aw.id} value={aw.id}>{aw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Step 2 — pick a category (filtered to chosen award) */}
            <div>
              <Label>Category *</Label>
              <Select
                value={nomCategoryId}
                onValueChange={setNomCategoryId}
                disabled={!nomAwardId || nomCategories.length === 0}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={
                    !nomAwardId ? 'Select an award first' :
                    nomCategories.length === 0 ? 'No categories available' :
                    'Select category'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {nomCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Your Name / Artist Name *</Label>
              <Input className="mt-1" value={nomName} onChange={e => setNomName(e.target.value)} placeholder="Enter your name" />
            </div>
            <div>
              <Label>Photo (Optional)</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={e => {
                  if (e.target.files?.[0]) setNomPhoto(e.target.files[0]);
                }}
              />
            </div>
            <div>
              <Label>Payment Method *</Label>
              <Select value={nomPayMethod} onValueChange={v => setNomPayMethod(v as 'mobile_money' | 'card')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {nomPayMethod === 'mobile_money' && (
              <div>
                <Label>Phone Number *</Label>
                <Input className="mt-1" value={nomPhone} onChange={e => setNomPhone(e.target.value)} placeholder="e.g. 0977123456" />
              </div>
            )}
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
              Your nomination will only be confirmed after Lipila verifies your payment.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNomDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleNominate} disabled={nomLoading}>
              {nomLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pay {formatCurrency(nomineeFee)} & Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voting Dialog with Lipila payment verification & states */}
      <VoteDialog
        open={voteDialog}
        onOpenChange={setVoteDialog}
        nominee={voteNominee}
        pricePerVote={voteMin}
      />

      {/* Share Sheet */}
      <ShareSheet
        open={shareData.open}
        onClose={() => setShareData(prev => ({ ...prev, open: false }))}
        url={shareData.url}
        title={shareData.title}
        thumbnailUrl={shareData.thumbnailUrl}
      />
    </div>
  );
}
