// Supabase Edge Function: lipila-payment
// Handles creating server-side payment records and initiating Lipila mobile-money collections.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const apiKey       = Deno.env.get('LIPILA_API_KEY') ?? '';
  const webhookUrl   = Deno.env.get('LIPILA_WEBHOOK_URL') ?? '';
  const baseUrl      = (Deno.env.get('LIPILA_API_URL') ?? 'https://blz.lipila.io').replace(/\/$/, '');
  const endpoint     = `${baseUrl}/api/v1/collections/mobile-money`;
  const votePriceEnv = Number(Deno.env.get('VOTE_PRICE') ?? '5');

  if (!apiKey) return json({ error: 'Payment gateway not configured' }, 503);
  if (!serviceKey || !supabaseUrl) return json({ error: 'Supabase service key not configured' }, 500);

  const supabase = createClient(supabaseUrl, serviceKey);

  // Resolve optional JWT to associate with a logged-in user (but anonymous allowed for votes)
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  let userId: string | null = null;
  if (token && token !== serviceKey) {
    try {
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) userId = data.user.id;
    } catch (e) {
      console.warn('[lipila-payment] could not resolve user from token');
    }
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Expected body for vote: { payment_type: 'vote', nominee_id, category_id, vote_count, phone_number, idempotency_key }
  const {
    payment_type,
    nominee_id,
    category_id,
    vote_count,
    phone_number,
    payment_method = 'mobile_money',
    idempotency_key,
    description,
    metadata = {},
  } = body;

  // Only votes are allowed for anonymous users in this function
  if (!userId && payment_type !== 'vote' && payment_type !== 'donation') {
    return json({ error: 'Unauthorized: must be logged in for this payment type' }, 401);
  }

  // Idempotency check
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from('payments')
      .select('id,status')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();
    if (existing) {
      return json({ payment_id: existing.id, status: existing.status });
    }
  }

  // Server-side amount calculation for votes
  let amount = Number(body.amount ?? 0);
  if (payment_type === 'vote') {
    const vc = Number(vote_count ?? 1);
    if (!nominee_id || !category_id) return json({ error: 'nominee_id and category_id are required for votes' }, 400);
    if (!Number.isFinite(vc) || vc <= 0) return json({ error: 'Invalid vote_count' }, 400);
    amount = vc * votePriceEnv;
    // store vote metadata
    metadata = { ...metadata, nominee_id, category_id, vote_count: vc };
  }

  if (payment_method === 'mobile_money' && amount > 0 && !phone_number) {
    return json({ error: 'Phone number is required for mobile money payments' }, 400);
  }

  try {
    // Create pending payment record
    const { data: payment, error: payErr } = await supabase.from('payments').insert({
      user_id: userId ?? null,
      amount,
      currency: 'ZMW',
      payment_method,
      payment_type,
      status: 'pending',
      phone_number: phone_number ?? null,
      idempotency_key: idempotency_key ?? null,
      metadata,
    }).select().single();

    if (payErr || !payment) {
      console.error('[lipila-payment] failed to create payment record', payErr);
      return json({ error: 'Failed to create payment record' }, 500);
    }

    // If amount is zero, auto-complete without calling Lipila
    if (amount === 0) {
      await supabase.from('payments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', payment.id);
      return json({ payment_id: payment.id, status: 'completed', message: 'Auto-approved (zero amount)' });
    }

    // Normalize phone to 260XXXXXXXXX
    const raw = (phone_number ?? '').replace(/[\s\-\(\)]/g, '');
    const accountNumber = raw.startsWith('260') ? raw
      : raw.startsWith('0') ? '260' + raw.slice(1)
      : raw.length === 9 ? '260' + raw
      : raw;

    const lipilaPayload = {
      referenceId: payment.id,
      amount,
      narration: description ?? `ZedVevo ${payment_type}`,
      accountNumber,
      currency: 'ZMW',
      email: '',
      referenceData: `ZedVevo: ${payment_type}`,
    };

    const headers: Record<string,string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'x-api-key': apiKey,
    };
    if (webhookUrl) headers['callbackUrl'] = webhookUrl;

    const gwRes = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(lipilaPayload) });
    const gwText = await gwRes.text();
    let gwData: any = {};
    try { gwData = JSON.parse(gwText); } catch {}

    if (gwRes.status === 200 || gwRes.status === 201) {
      // mark lipila identifiers if present
      await supabase.from('payments').update({
        lipila_transaction_id: gwData.identifier ?? gwData.referenceId ?? null,
        lipila_reference: gwData.referenceId ?? payment.id,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id);

      return json({ payment_id: payment.id, status: 'pending', message: 'Payment request sent. Check your phone.' });
    }

    // Non-2xx from gateway
    const failMsg = String(gwData.message ?? gwData.status ?? gwText).slice(0,400);
    const isInsufficient = failMsg.toUpperCase().includes('LOW_BALANCE') || failMsg.toLowerCase().includes('insufficient');
    await supabase.from('payments').update({ status: isInsufficient ? 'insufficient_funds' : 'failed', failure_reason: failMsg, updated_at: new Date().toISOString() }).eq('id', payment.id);

    return json({ error: `Payment initiation failed: ${failMsg}`, status: isInsufficient ? 'insufficient_funds' : 'failed', payment_id: payment.id }, 502);

  } catch (err) {
    console.error('[lipila-payment] unexpected error', err);
    return json({ error: 'Internal error' }, 500);
  }
});
