import { useEffect, useState } from 'react';
import {
  Save, Loader2, Key, Power, PowerOff, Eye, EyeOff, Copy,
  ArrowUpRight, Wallet, ArrowDownRight, RefreshCw, Smartphone,
  CheckCircle2, AlertCircle, Building, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getLipilaConfig, updateLipilaConfig, getAllPayments, getAllSponsors,
  getPlatformBalance, getPayouts, requestLipilaWithdrawal,
  type LipilaConfig, type Payment, type Sponsor, type PlatformBalance, type PayoutRecord
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

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

  // Real-time Platform Balance & Withdrawals State
  const [balance, setBalance] = useState<PlatformBalance>({
    totalInflow: 0,
    totalOutflow: 0,
    availableBalance: 0,
    pendingDisbursements: 0,
    successfulTransactionsCount: 0,
    totalWithdrawalsCount: 0,
  });
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Withdrawal Dialog State
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState<'MTN' | 'Airtel' | 'Zamtel' | 'Bank'>('MTN');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawName, setWithdrawName] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    Promise.all([loadConfig(), loadPayments(), loadBalanceAndPayouts()])
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

  const loadBalanceAndPayouts = async () => {
    setBalanceLoading(true);
    try {
      const [bal, pList] = await Promise.all([getPlatformBalance(), getPayouts()]);
      setBalance(bal);
      setPayouts(pList);
    } catch (err) {
      console.error('Failed to fetch balance or payouts:', err);
    } finally {
      setBalanceLoading(false);
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

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }

    if (amountNum > balance.availableBalance) {
      toast.error(`Insufficient balance. Maximum available is ${formatCurrency(balance.availableBalance)}`);
      return;
    }

    if (!withdrawPhone.trim() || withdrawPhone.replace(/\D/g, '').length < 9) {
      toast.error('Please enter a valid 10-digit Zambian phone number or bank account');
      return;
    }

    setWithdrawing(true);
    try {
      const result = await requestLipilaWithdrawal({
        amount: amountNum,
        network: withdrawNetwork,
        phoneNumber: withdrawPhone.trim(),
        recipientName: withdrawName.trim() || 'Admin Disbursement',
        notes: withdrawNotes.trim() || 'ZedVevo Revenue Withdrawal',
      });

      toast.success(result.message || 'Withdrawal processed successfully!');
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawPhone('');
      setWithdrawName('');
      setWithdrawNotes('');

      // Refresh balance and tables in real time
      await loadBalanceAndPayouts();
      await loadPayments();
    } catch (err: unknown) {
      console.error('Withdrawal error:', err);
      toast.error((err as Error).message || 'Failed to process withdrawal. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Payment Gateway & Live Balance</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time Lipila gateway configuration, live balance, and instant Mobile Money withdrawals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadBalanceAndPayouts}
            disabled={balanceLoading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${balanceLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Balance</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setWithdrawOpen(true)}
            className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs font-semibold shadow-sm"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Withdraw to Lipila</span>
          </Button>
        </div>
      </div>

      {/* Real-time Balance Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Available Balance */}
        <Card className="bg-gradient-to-br from-emerald-950/40 via-card to-card border-emerald-500/30">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-400">Available Balance</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {formatCurrency(balance.availableBalance)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Live withdrawable platform revenue
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Inflow */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Inflow (Revenue)</span>
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {formatCurrency(balance.totalInflow)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {balance.successfulTransactionsCount} successful customer payments
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Withdrawn */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Withdrawn</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {formatCurrency(balance.totalOutflow)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {balance.totalWithdrawalsCount} completed disbursements
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pending Outflow */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pending Payouts</span>
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                <History className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {formatCurrency(balance.pendingDisbursements)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Currently processing via Lipila
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Withdrawal History Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-400" />
              Recent Withdrawals & Disbursements
            </CardTitle>
            <CardDescription className="text-xs">
              Live ledger of admin mobile money payouts processed via Lipila
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWithdrawOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            New Withdrawal
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">Reference</th>
                  <th className="text-left py-2.5 px-3">Network</th>
                  <th className="text-left py-2.5 px-3">Recipient</th>
                  <th className="text-left py-2.5 px-3">Amount</th>
                  <th className="text-left py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {balanceLoading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-accent" />
                      Loading real-time withdrawals ledger...
                    </td>
                  </tr>
                ) : payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No withdrawals recorded yet. Tap "Withdraw to Lipila" to disburse funds.
                    </td>
                  </tr>
                ) : (
                  payouts.slice(0, 15).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {p.reference}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {p.network}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        <span className="font-medium text-foreground">{p.recipient_phone}</span>
                        {p.recipient_name && (
                          <span className="text-muted-foreground text-[11px] block">{p.recipient_name}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={
                            p.status === 'successful'
                              ? 'default'
                              : p.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-[10px] capitalize"
                        >
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Lipila Gateway Configuration Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-accent" />
            Lipila API Credentials & Webhook Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Connect your Lipila Zambian merchant account for automated collections and disbursements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-9 bg-muted rounded animate-pulse" />
              <div className="h-9 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-9 bg-muted rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Merchant ID *</Label>
                  <Input
                    className="mt-1 h-9 text-sm"
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="e.g. MERCH_ZEDVEVO_01"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Service ID *</Label>
                  <Input
                    className="mt-1 h-9 text-sm"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    placeholder="e.g. SRV_PAY_MOMO_99"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">API Key *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Lipila API Key (e.g. Lsk_live_...)"
                    className="pr-20 h-9 text-sm font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {apiKey && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(apiKey)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Webhook Secret (Optional)</Label>
                <div className="relative mt-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="Secret for verifying incoming Lipila IPNs"
                    className="pr-16 h-9 text-sm font-mono"
                  />
                  {webhookSecret && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label className="text-sm cursor-pointer">
                  {isActive ? 'Gateway Active (Processing Live Payments & Payouts)' : 'Gateway Disabled'}
                </Label>
              </div>

              {config && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {config.is_active ? <Power className="h-3 w-3 mr-1 text-emerald-400" /> : <PowerOff className="h-3 w-3 mr-1" />}
                    {config.is_active ? 'Production Ready' : 'Disabled'}
                  </Badge>
                  <span>Updated: {new Date(config.updated_at).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  className="bg-accent hover:bg-accent/90 text-accent-foreground h-9 px-4 text-xs font-semibold"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Lipila Settings
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Live Withdrawal Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Real-time Lipila Withdrawal</DialogTitle>
                <DialogDescription className="text-xs">
                  Disburse platform revenue directly to MTN, Airtel, Zamtel, or Bank
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleWithdrawSubmit} className="space-y-4 pt-2">
            {/* Balance Notice */}
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Available to Withdraw</span>
                <p className="text-lg font-bold text-emerald-400">{formatCurrency(balance.availableBalance)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                onClick={() => setWithdrawAmount(balance.availableBalance.toString())}
              >
                Use Max
              </Button>
            </div>

            {/* Network Selector */}
            <div>
              <Label className="text-xs font-semibold">Destination Network / Method *</Label>
              <Select
                value={withdrawNetwork}
                onValueChange={(v) => setWithdrawNetwork(v as 'MTN' | 'Airtel' | 'Zamtel' | 'Bank')}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTN">MTN Mobile Money (MoMo)</SelectItem>
                  <SelectItem value="Airtel">Airtel Money Zambia</SelectItem>
                  <SelectItem value="Zamtel">Zamtel Kwacha</SelectItem>
                  <SelectItem value="Bank">Direct Bank Wire (Zambian Commercial Banks)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number / Account */}
            <div>
              <Label className="text-xs font-semibold">
                {withdrawNetwork === 'Bank' ? 'Bank Account Number *' : 'Recipient Phone Number *'}
              </Label>
              <Input
                className="mt-1 h-9 text-sm"
                placeholder={withdrawNetwork === 'Bank' ? 'e.g. 1029384756 (Stanbic/Zanaco)' : 'e.g. 0977123456 or 0966123456'}
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
                required
              />
            </div>

            {/* Recipient Full Name */}
            <div>
              <Label className="text-xs font-semibold">Recipient Registered Name</Label>
              <Input
                className="mt-1 h-9 text-sm"
                placeholder="e.g. ZedVevo Admin / Your Full Name"
                value={withdrawName}
                onChange={(e) => setWithdrawName(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div>
              <Label className="text-xs font-semibold">Withdrawal Amount (ZMW) *</Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                max={balance.availableBalance}
                className="mt-1 h-9 text-sm font-semibold"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                required
              />
              <div className="flex gap-2 mt-2">
                {[50, 100, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWithdrawAmount(preset.toString())}
                    className="text-[11px] px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground font-medium transition-colors"
                  >
                    K{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-semibold">Payout Narration (Optional)</Label>
              <Input
                className="mt-1 h-9 text-sm"
                placeholder="e.g. ZedVevo Platform Payout Q3"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawing}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={withdrawing || balance.availableBalance <= 0}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5"
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                <span>Confirm & Disburse Funds</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
