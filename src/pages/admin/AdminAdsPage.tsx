import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Megaphone, ExternalLink, BarChart2, Eye, MousePointer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getRealAds, saveRealAds, type Advertisement } from '@/services/adsService';

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<Advertisement['provider']>('custom_banner');
  const [type, setType] = useState<Advertisement['type']>('banner');
  const [placement, setPlacement] = useState<Advertisement['placement']>('all');
  const [format, setFormat] = useState<Advertisement['format']>('leaderboard');
  const [headline, setHeadline] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [ctaText, setCtaText] = useState('Learn More');
  const [scriptCode, setScriptCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    setLoading(true);
    try {
      const data = await getRealAds();
      setAds(data);
    } catch (err: any) {
      toast.error('Failed loading ads: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingAd(null);
    setName('');
    setProvider('custom_banner');
    setType('banner');
    setPlacement('all');
    setFormat('leaderboard');
    setHeadline('');
    setImageUrl('');
    setTargetUrl('');
    setCtaText('Learn More');
    setScriptCode('');
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (ad: Advertisement) => {
    setEditingAd(ad);
    setName(ad.name);
    setProvider(ad.provider);
    setType(ad.type);
    setPlacement(ad.placement);
    setFormat(ad.format);
    setHeadline(ad.headline || '');
    setImageUrl(ad.image_url || '');
    setTargetUrl(ad.target_url || '');
    setCtaText(ad.cta_text || 'Learn More');
    setScriptCode(ad.script_code || '');
    setIsActive(ad.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please provide an ad campaign name');
      return;
    }

    const updated = [...ads];
    if (editingAd) {
      const idx = updated.findIndex(a => a.id === editingAd.id);
      if (idx !== -1) {
        updated[idx] = {
          ...editingAd,
          name: name.trim(),
          provider,
          type,
          placement,
          format,
          headline: headline.trim(),
          image_url: imageUrl.trim(),
          target_url: targetUrl.trim(),
          cta_text: ctaText.trim(),
          script_code: scriptCode.trim(),
          is_active: isActive,
        };
      }
    } else {
      const newAd: Advertisement = {
        id: 'ad-' + Date.now(),
        name: name.trim(),
        provider,
        type,
        placement,
        format,
        headline: headline.trim(),
        image_url: imageUrl.trim(),
        target_url: targetUrl.trim(),
        cta_text: ctaText.trim(),
        script_code: scriptCode.trim(),
        is_active: isActive,
        display_order: ads.length + 1,
        impressions: 0,
        clicks: 0,
        created_at: new Date().toISOString(),
      };
      updated.unshift(newAd);
    }

    const ok = await saveRealAds(updated);
    if (ok) {
      setAds(updated);
      setDialogOpen(false);
      toast.success(editingAd ? 'Ad updated successfully' : 'Real ad created and published!');
    } else {
      toast.error('Failed to save ad');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;
    const filtered = ads.filter(a => a.id !== id);
    const ok = await saveRealAds(filtered);
    if (ok) {
      setAds(filtered);
      toast.success('Ad removed');
    }
  };

  const toggleAdActive = async (ad: Advertisement) => {
    const updated = ads.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a);
    const ok = await saveRealAds(updated);
    if (ok) {
      setAds(updated);
      toast.success(`Ad is now ${!ad.is_active ? 'Active' : 'Paused'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-accent" /> Real Advertisements
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage real ads from Google AdSense, Adsterra, PropellerAds, PopAds, or custom banners. Add, pause, or edit anytime.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-accent text-accent-foreground gap-2 font-semibold">
          <Plus className="h-4 w-4" /> Add Real Ad
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground font-medium">Total Campaigns</div>
          <div className="text-2xl font-bold mt-1">{ads.length}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {ads.filter(a => a.is_active).length} currently active
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 text-accent" /> Total Impressions
          </div>
          <div className="text-2xl font-bold mt-1">
            {ads.reduce((acc, a) => acc + (a.impressions || 0), 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Across all placements</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <MousePointer className="h-3.5 w-3.5 text-green-500" /> Total Clicks
          </div>
          <div className="text-2xl font-bold mt-1">
            {ads.reduce((acc, a) => acc + (a.clicks || 0), 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Direct user engagements</div>
        </div>
      </div>

      {/* Ads List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold">Active & Scheduled Ads</h2>
          <Button variant="outline" size="sm" onClick={loadAds} className="text-xs">
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading advertisements...</div>
        ) : ads.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm">No ads created yet.</p>
            <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-3">
              Create First Ad
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ads.map(ad => (
              <div key={ad.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.name} className="w-16 h-12 object-cover rounded-lg border border-border shrink-0" />
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border uppercase">
                      {ad.provider.slice(0, 4)}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{ad.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted uppercase tracking-wider text-muted-foreground">
                        {ad.provider.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent uppercase tracking-wider">
                        {ad.placement}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                        {ad.type}
                      </span>
                    </div>

                    {ad.headline && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{ad.headline}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span>{(ad.impressions || 0).toLocaleString()} views</span>
                      <span>{(ad.clicks || 0).toLocaleString()} clicks</span>
                      {ad.target_url && (
                        <a href={ad.target_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                          Destination <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{ad.is_active ? 'Active' : 'Paused'}</span>
                    <Switch checked={ad.is_active} onCheckedChange={() => toggleAdActive(ad)} />
                  </div>

                  <Button size="sm" variant="ghost" onClick={() => openEditDialog(ad)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>

                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(ad.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAd ? 'Edit Advertisement' : 'Create New Real Ad'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Campaign / Ad Name</Label>
              <Input
                placeholder="e.g. MTN MoMo Banner, AdSense Header, Propeller Pop"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Ad Provider / Service</Label>
                <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom_banner">Custom Image Banner</SelectItem>
                    <SelectItem value="adsense">Google AdSense</SelectItem>
                    <SelectItem value="adsterra">Adsterra</SelectItem>
                    <SelectItem value="propeller">PropellerAds</SelectItem>
                    <SelectItem value="popads">PopAds</SelectItem>
                    <SelectItem value="custom_script">Raw HTML / Script Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Ad Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Display Banner</SelectItem>
                    <SelectItem value="script">Injected Script Code</SelectItem>
                    <SelectItem value="popup">Pop-up Modal Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Placement</Label>
                <Select value={placement} onValueChange={(v: any) => setPlacement(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everywhere / All Pages</SelectItem>
                    <SelectItem value="home">Homepage Only</SelectItem>
                    <SelectItem value="music">Music Section</SelectItem>
                    <SelectItem value="videos">Videos Section</SelectItem>
                    <SelectItem value="awards">Awards Section</SelectItem>
                    <SelectItem value="popup">Pop-up Overlay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Format</Label>
                <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leaderboard">Leaderboard (728x90)</SelectItem>
                    <SelectItem value="feed">In-Feed (Large)</SelectItem>
                    <SelectItem value="rectangle">Medium Rectangle (300x250)</SelectItem>
                    <SelectItem value="compact">Compact Ribbon</SelectItem>
                    <SelectItem value="popup_modal">Pop-up Window</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {provider === 'custom_banner' || type === 'popup' ? (
              <>
                <div>
                  <Label className="text-xs font-semibold">Banner Image URL</Label>
                  <Input
                    placeholder="https://... image banner URL"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Headline / Tagline</Label>
                  <Input
                    placeholder="e.g. Vote now for Zambian Music Awards 2026"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Destination / Target URL</Label>
                    <Input
                      placeholder="https://... or /awards"
                      value={targetUrl}
                      onChange={e => setTargetUrl(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Button Text</Label>
                    <Input
                      placeholder="e.g. Learn More, Dial *778#"
                      value={ctaText}
                      onChange={e => setCtaText(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label className="text-xs font-semibold">Ad Tag / Script Code</Label>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Paste the official code snippet from {provider} (e.g. Google AdSense &lt;ins&gt; tag or script).
                </p>
                <Textarea
                  placeholder={`<script type="text/javascript" src="//..."></script>\n<ins class="adsbygoogle" ...></ins>`}
                  value={scriptCode}
                  onChange={e => setScriptCode(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <span className="text-xs font-semibold">Publish & Activate Immediately</span>
                <p className="text-[11px] text-muted-foreground">Will render on the live website immediately</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground">
              {editingAd ? 'Save Changes' : 'Publish Ad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
