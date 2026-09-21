import { useEffect, useState } from 'react';
import { Save, Loader2, Key, Power, PowerOff, Eye, EyeOff, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { getLipilaConfig, updateLipilaConfig, getAllPayments, getAllSponsors } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { LipilaConfig, Payment, Sponsor } from '@/lib/api';

export default function AdminPaymentGatewayPage() {
  const [config, setConfig] = useState<LipilaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [merchantId, setMerchantId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadConfig(), loadPayments()])
      .catch(console.error);
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await getLipilaConfig();
      if (cfg) {
        setConfig(cfg);
        setMerchantId(cfg.merchant_id || '');
        setServiceId(cfg.service_id || '');
        setApiKey(cfg.api_key || '');
        setWebhookSecret(cfg.webhook_secret || '');
        setIsActive(cfg.is_active);
      } else {
        setConfig(null);
        setMerchantId('');
        setServiceId('');
        setApiKey('');
        setWebhookSecret('');
        setIsActive(true);
      }
    } catch (e: unknown) {
      toast.error('Failed to load gateway config');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    try {
      const p = await getAllPayments();
      setPayments(p);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!merchantId || !serviceId || !apiKey) {
      toast.error('Merchant ID, Service ID, and API Key are required');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateLipilaConfig({
        id: config?.id,
        merchant_id: merchantId.trim(),
        service_id: serviceId.trim(),
        api_key: apiKey.trim(),
        webhook_secret: webhookSecret || undefined,
        is_active: isActive,
      });
      setConfig(saved);
      toast.success('Gateway configuration saved');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const totalRevenue = payments.filter(p => p.status === 'successful').reduce((a, p) => a + Number(p.amount), 0);
  const totalTransactions = payments.filter(p => p.status === 'successful').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Payment Gateway</h1>
        <p className="text-sm text-muted-foreground">Manage Lipila mobile money gateway configuration</p>
      </div>

      {/* Config Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-accent" />
            Lipila Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse" />
              <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-8 bg-muted rounded animate-pulse" />
              <div className="h-8 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Merchant ID *</Label>
                  <Input className="mt-1" value={merchantId} onChange={e => setMerchantId(e.target.value)} placeholder="Your Lipila merchant ID" />
                </div>
                <div>
                  <Label>Service ID *</Label>
                  <Input className="mt-1" value={serviceId} onChange={e => setServiceId(e.target.value)} placeholder="Your Lipila service ID" />
                </div>
              </div>

              <div>
                <Label>API Key *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="Lipila API key (starts with Lsk)"
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button type="button" onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-foreground">
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {apiKey && (
                      <button type="button" onClick={() => copyToClipboard(apiKey)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label>Webhook Secret (optional)</Label>
                <div className="relative mt-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={webhookSecret}
                    onChange={e => setWebhookSecret(e.target.value)}
                    placeholder="Webhook verification secret"
                    className="pr-16"
                  />
                  {webhookSecret && (
                    <button type="button" onClick={() => copyToClipboard(webhookSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label className="text-sm">{isActive ? 'Gateway Active' : 'Gateway Disabled'}</Label>
              </div>

              {config && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    {config.is_active ? <Power className="h-3 w-3 mr-1" /> : <PowerOff className="h-3 w-3 mr-1" />}
                    {config.is_active ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
                  <span>Updated: {new Date(config.updated_at).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save Configuration
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Payment Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-6 bg-muted rounded animate-pulse w-1/4" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Successful Revenue</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTransactions}</p>
                <p className="text-xs text-muted-foreground">Successful Transactions</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{payments.length}</p>
                <p className="text-xs text-muted-foreground">Total Payment Records</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sponsor payments reference */}
      <SponsorPaymentsSection />
    </div>
  );
}

function SponsorPaymentsSection() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllSponsors().then(setSponsors).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Sponsor Tiers</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-5 bg-muted rounded animate-pulse" />
            <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
          </div>
        ) : sponsors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sponsors configured yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {sponsors
              .filter(s => s.is_active)
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              .map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground"> — {s.tier}</span>
                  </div>
                  {s.website_url && (
                    <a href={s.website_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                      {s.website_url}
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

void SponsorPaymentsSection;
