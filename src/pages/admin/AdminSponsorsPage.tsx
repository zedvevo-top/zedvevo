import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Globe, MoveUp, MoveDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getAllSponsors, createSponsor, updateSponsor, deleteSponsor, getAllAwards } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Sponsor, Award } from '@/types/index';

type SponsorTier = 'gold' | 'silver' | 'bronze';

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);

  const [dlg, setDlg] = useState<{ open: boolean; sponsor?: Sponsor }>({ open: false });
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [tier, setTier] = useState<SponsorTier>('bronze');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [awardId, setAwardId] = useState<string | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAllSponsors(), getAllAwards()])
      .then(([s, a]) => { setSponsors(s); setAwards(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openDlg = (sponsor?: Sponsor) => {
    setName(sponsor?.name || '');
    setLogoUrl(sponsor?.logo_url || '');
    setWebsite(sponsor?.website_url || '');
    setTier((sponsor?.tier as SponsorTier) || 'bronze');
    setDisplayOrder(String(sponsor?.display_order ?? 0));
    setIsActive(sponsor?.is_active ?? true);
    setAwardId(sponsor?.award_id || '');
    setDlg({ open: true, sponsor });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        logo_url: logoUrl || undefined,
        website_url: website || undefined,
        tier,
        display_order: parseInt(displayOrder) || 0,
        is_active: isActive,
        award_id: awardId || null,
      };
      if (dlg.sponsor) {
        await updateSponsor(dlg.sponsor.id, payload);
        setSponsors(p => p.map(s => s.id === dlg.sponsor!.id ? { ...s, ...payload } : s));
        toast.success('Sponsor updated');
      } else {
        const result = await createSponsor(payload);
        void result;
        setSponsors(await getAllSponsors());
        toast.success('Sponsor created');
      }
      setDlg({ open: false });
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to save sponsor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sponsor?')) return;
    try {
      await deleteSponsor(id);
      setSponsors(p => p.filter(s => s.id !== id));
      toast.success('Sponsor deleted');
    } catch {
      toast.error('Failed to delete sponsor');
    }
  };

  const tierBadge = (t: string) => {
    const colors: Record<string, string> = {
      gold: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
      silver: 'bg-gray-400/10 text-gray-600 border-gray-400/30',
      bronze: 'bg-amber-600/10 text-amber-600 border-amber-600/30',
    };
    return (
      <Badge variant="outline" className={`text-[10px] capitalize ${colors[t] || 'bg-muted text-muted-foreground border-border'}`}>
        {t}
      </Badge>
    );
  };

  const move = async (id: string, dir: 'up' | 'down') => {
    const idx = sponsors.findIndex(s => s.id === id);
    if (idx === -1) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sponsors.length) return;
    const [moved] = sponsors.splice(idx, 1);
    sponsors.splice(newIdx, 0, moved);
    setSponsors([...sponsors]);
    const updates = sponsors.map((s, i) => updateSponsor(s.id, { display_order: i }));
    await Promise.all(updates);
    toast.success('Display order updated');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Sponsors</h1>
          <p className="text-sm text-muted-foreground">{sponsors.length} sponsors registered</p>
        </div>
        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
          onClick={() => openDlg()}>
          <Plus className="h-3.5 w-3.5" />Add Sponsor
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : sponsors.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-sm text-muted-foreground">No sponsors yet. Add your first sponsor to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                {['Logo', 'Name', 'Tier', 'Award', 'Website', 'Order', 'Active', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s, i) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="h-8 w-8 rounded object-cover" />
                    ) : <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-medium max-w-[140px] truncate">{s.name}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{tierBadge(s.tier)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs max-w-[140px] truncate">
                    {s.award_id ? (awards.find(a => a.id === s.award_id)?.name || s.award_id.slice(0, 8)) : 'General'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs max-w-[140px] truncate">
                    {s.website_url ? <a href={s.website_url} target="_blank" rel="noreferrer" className="hover:text-foreground">{s.website_url}</a> : '—'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{s.display_order}</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5"
                        onClick={() => move(s.id, 'up')} disabled={i === 0}>
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5"
                        onClick={() => move(s.id, 'down')} disabled={i === sponsors.length - 1}>
                        <MoveDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <Switch checked={s.is_active} onCheckedChange={async v => {
                      await updateSponsor(s.id, { is_active: v });
                      setSponsors(p => p.map(x => x.id === s.id ? { ...x, is_active: v } : x));
                      toast.success(`Sponsor ${v ? 'activated' : 'deactivated'}`);
                    }} />
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(s.created_at)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDlg(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dlg.open} onOpenChange={o => setDlg({ open: o })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{dlg.sponsor ? 'Edit' : 'New'} Sponsor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div><Label>Name *</Label><Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Sponsor name" /></div>
            <div><Label>Logo URL</Label><Input className="mt-1" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
            <div><Label>Website URL</Label><Input className="mt-1" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." /></div>
            <div>
              <Label>Tier</Label>
              <Select value={tier} onValueChange={v => setTier(v as SponsorTier)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Award (optional)</Label>
              <Select value={awardId || '_none'} onValueChange={v => setAwardId(v === '_none' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="General (no specific award)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">General Sponsor</SelectItem>
                  {awards.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.year})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Display Order</Label><Input className="mt-1" type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} /></div>
              <div className="flex items-end gap-2 pb-0.5"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Active</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
