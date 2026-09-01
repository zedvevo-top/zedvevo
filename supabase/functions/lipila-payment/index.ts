// Supabase Edge Function: lipila-payment
// ─────────────────────────────────────────────────────────────────────────────
// Official Lipila API — source: https://docs.lipila.io/docs/collections/momocollections
//
// Sandbox base:    https://api.lipila.dev
// Production base: https://blz.lipila.io
//
// Endpoint:  POST /api/v1/collections/mobile-money
// Headers:
//   x-api-key:   <your Lipila secret key (starts with Lsk)>
//   callbackUrl: <your webhook URL>
//   Content-Type: application/json
//   accept:       application/json
//
// Body fields:
//   referenceId    string  required  unique ref for the transaction
//   amount         number  required  amount to collect
//   narration      string  required  description/note
//   accountNumber  string  required  payer mobile number 260XXXXXXXXX
//   currency       string  required  e.g. ZMW
//   email          string  optional  payer email
//   referenceData  string  optional  extra description
//
// Success response (200): { currency, amount, accountNumber, status:"Pending",
//   paymentType, referenceId, identifier, message:"Transaction Successful" }
// Failure response: { referenceId, currency, amount, accountNumber,
//   status:"Failed", paymentType, message: <reason> }
//
// Required Supabase secrets:
//   LIPILA_API_KEY      — your Lipila secret key (Lsk...)
//   LIPILA_WEBHOOK_URL  — public URL of your lipila-webhook edge function
//   LIPILA_API_URL      — optional; defaults to https://blz.lipila.io (production)
//                         set to https://api.lipila.dev for sandbox testing

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

  // ── Secrets ────────────────────────────────────────────────────────
  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const apiKey       = Deno.env.get('LIPILA_API_KEY') ?? '';
  const webhookUrl   = Deno.env.get('LIPILA_WEBHOOK_URL') ?? '';
  // Default to production; override with https://api.lipila.dev for sandbox
  const baseUrl      = (Deno.env.get('LIPILA_API_URL') ?? 'https://blz.lipila.io').replace(/\/$/, '');
  const endpoint     = `${baseUrl}/api/v1/collections/mobile-money`;

  console.log('[lipila] boot — apiKey set:', !!apiKey, 'base:', baseUrl, 'webhook:', webhookUrl);

  if (!apiKey) {
    console.error('[lipila] LIPILA_API_KEY not configured');
    return json({ error: 'Payment gateway not configured (missing API key). Contact support.' }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Auth: resolve userId from JWT ──────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  let userId: string | null = null;

  if (token && token !== serviceKey) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) userId = user.id;
  }

  // ── Parse body ─────────────────────────────────────────────────────
  let body: {
    amount: number;
    payment_method: string;
    phone_number?: string;
    description?: string;
    idempotency_key: string;
    payment_type: string;
    plan_id?: string;
    user_id?: string;
    metadata?: Record<string, unknown>;
  };

  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request body' }, 400); }

  // Allow anonymous/guest donations — store NULL user_id (UUID FK requires null not a fake string)
  if (!userId && body.payment_type === 'donation') {
    console.log('[lipila] guest donor — user_id will be null');
    userId = null;
  }
  if (body.payment_type !== 'donation' && !userId) {
    return json({ error: 'Unauthorized: could not identify user' }, 401);
  }

  const { amount, payment_method, phone_number, description,
          idempotency_key, payment_type, plan_id, metadata } = body;

  console.log('[lipila] request — user:', userId, 'method:', payment_method, 'amount:', amount);

  if (amount === undefined || amount === null) return json({ error: 'Invalid amount' }, 400);
  if (amount < 0) return json({ error: 'Amount cannot be negative' }, 400);
  if (payment_method === 'mobile_money' && amount > 0 && !phone_number)
    return json({ error: 'Phone number is required for mobile money payments' }, 400);

  // ── Idempotency ─────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('payments').select('id, status').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) {
    console.log('[lipila] duplicate key, returning existing:', existing.id);
    return json({ payment_id: existing.id, status: existing.status });
  }

  // ── Handle 0.00 amount auto-approval ─────────────────────────────────
  if (amount === 0) {
    console.log('[lipila] zero amount - auto-approving');
    
    // Create completed payment record
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId ?? null,
        amount: 0,
        payment_method,
        payment_type,
        plan_id: plan_id ?? null,
        status: 'completed',
        phone_number: phone_number ?? null,
        idempotency_key: idempotencyKey,
        metadata: metadata ?? {},
        completed_at: new Date().toISOString(),
      })
      .select().single();

    if (payErr || !payment) {
      console.error('[lipila] zero-amount payment record failed:', JSON.stringify(payErr));
      return json({ error: 'Failed to create payment record' }, 500);
    }

    // Auto-approve based on payment type
    if (payment_type === 'nominee_registration' && metadata?.category_id && metadata?.nominee_name && userId) {
      const nomMetadata = metadata as Record<string, any>;
      const { data: existing } = await supabase
        .from('nominees')
        .select('id')
        .eq('user_id', userId)
        .eq('category_id', nomMetadata.category_id)
        .maybeSingle();

      if (existing) {
        await supabase.from('nominees').update({
          name: nomMetadata.nominee_name,
          registration_status: 'completed',
          nomination_status: 'approved',
          payment_id: payment.id,
        }).eq('id', existing.id);
      } else {
        await supabase.from('nominees').insert({
          user_id: userId,
          category_id: nomMetadata.category_id,
          name: nomMetadata.nominee_name,
          payment_id: payment.id,
          registration_status: 'completed',
          nomination_status: 'approved',
        });
      }
      console.log('[lipila] nominee auto-approved');
    } else if (payment_type === 'vote' && metadata?.nominee_id && metadata?.category_id && userId) {
      const voteMetadata = metadata as Record<string, any>;
      await supabase.from('votes').insert({
        user_id: userId,
        nominee_id: voteMetadata.nominee_id,
        category_id: voteMetadata.category_id,
        amount: 0,
        vote_count: voteMetadata.vote_count || 1,
        payment_id: payment.id,
        payment_status: 'successful',
      });
      console.log('[lipila] vote auto-created');
    }

    return json({
      payment_id: payment.id,
      status: 'completed',
      message: 'Auto-approved without payment required.'
    });
  }

    // ── Create pending payment record ──────────────────────────────────
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      user_id: userId ?? null,
      amount,
      payment_method,
      payment_type,
      plan_id: plan_id ?? null,
      status: 'pending',
      phone_number: phone_number ?? null,
      idempotency_key,
      metadata: metadata ?? {},
    })
    .select().single();

  if (payErr || !payment) {
    console.error('[lipila] DB insert failed:', JSON.stringify(payErr));
    return json({ error: 'Failed to create payment record: ' + (payErr?.message ?? 'unknown') }, 500);
  }
  console.log('[lipila] payment record:', payment.id);

  // ── Normalise phone → 260XXXXXXXXX (12 digits) ────────────────────
  const raw = (phone_number ?? '').replace(/[\s\-\(\)]/g, '');
  const accountNumber = raw.startsWith('260') ? raw
    : raw.startsWith('0') ? '260' + raw.slice(1)
    : raw.length === 9    ? '260' + raw
    : raw;

  // ── Build Lipila request payload ────────────────────────────────────
  // Per official docs: referenceId, amount, narration, accountNumber, currency
  const lipilaPayload = {
    referenceId: payment.id,
    amount,
    narration: description ?? `ZedVevo ${payment_type} payment`,
    accountNumber,
    currency: 'ZMW',
    email: '',
    referenceData: `ZedVevo platform — ${payment_type}`,
  };

  console.log('[lipila] POST', endpoint);
  console.log('[lipila] payload:', JSON.stringify(lipilaPayload));

  // ── Build request headers ──────────────────────────────────────────
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'accept': 'application/json',
    'x-api-key': apiKey,
  };
  // callbackUrl is optional but recommended — only add if configured
  if (webhookUrl) requestHeaders['callbackUrl'] = webhookUrl;

  try {
    const gwRes = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(lipilaPayload),
    });

    const gwText = await gwRes.text();
    console.log(`[lipila] response [${gwRes.status}]:`, gwText);

    let gwData: Record<string, unknown> = {};
    try { gwData = JSON.parse(gwText); } catch { /* non-JSON */ }

    // ── Success: 200 with status "Pending" ─────────────────────────
    if (gwRes.status === 200 || gwRes.status === 201) {
      const gwStatus = String(gwData.status ?? '').toLowerCase();

      // Transaction created — phone will get USSD PIN prompt
      if (['pending', 'successful', 'success'].includes(gwStatus) ||
          String(gwData.message ?? '').toLowerCase().includes('successful')) {
        await supabase.from('payments').update({
          lipila_transaction_id: (gwData.identifier ?? gwData.referenceId ?? null) as string | null,
          lipila_reference: (gwData.referenceId ?? payment.id) as string,
          updated_at: new Date().toISOString(),
        }).eq('id', payment.id);

        return json({
          payment_id: payment.id,
          status: 'pending',
          transaction_id: gwData.identifier as string ?? null,
          message: 'Payment request sent. Check your phone for the Mobile Money PIN prompt.',
        });
      }

      // Failed inside 200 (e.g. LOW_BALANCE message)
      const failMsg = String(gwData.message ?? gwData.status ?? 'Payment failed');
      const isInsufficient = failMsg.toUpperCase().includes('LOW_BALANCE') ||
        failMsg.toLowerCase().includes('insufficient');
      const failStatus = isInsufficient ? 'insufficient_funds' : 'failed';

      await supabase.from('payments').update({
        status: failStatus, failure_reason: failMsg,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id);

      if (userId) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: isInsufficient ? 'Insufficient Funds' : 'Payment Failed',
          message: isInsufficient
            ? 'Payment failed: insufficient funds. Please top up and try again.'
            : `Payment failed: ${failMsg}`,
          type: 'error', notification_type: 'payment_failed',
        });
      }

      return json({
        payment_id: payment.id, status: failStatus,
        error: isInsufficient
          ? 'Insufficient funds. Please top up your mobile money and try again.'
          : `Payment failed: ${failMsg}`,
      });
    }

    // ── Error responses (401, 400, 500, etc.) ──────────────────────
    console.error('[lipila] non-2xx response:', gwRes.status, gwText);

    const isInsufficient = gwText.toUpperCase().includes('LOW_BALANCE') ||
      gwText.toLowerCase().includes('insufficient');
    const failReason = isInsufficient ? 'Insufficient funds'
      : String(gwData.message ?? gwData.detail ?? gwData.error ?? `HTTP ${gwRes.status}`).slice(0, 400);

    await supabase.from('payments').update({
      status: isInsufficient ? 'insufficient_funds' : 'failed',
      failure_reason: failReason,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id);

    if (isInsufficient && userId) {
      await supabase.from('notifications').insert({
        user_id: userId, title: 'Insufficient Funds',
        message: 'Payment failed: insufficient funds. Please top up and try again.',
        type: 'error', notification_type: 'payment_failed',
      });
    }

    return json({
      error: isInsufficient
        ? 'Insufficient funds. Please top up your mobile money and try again.'
        : `Payment failed (${gwRes.status}): ${failReason}`,
      status: isInsufficient ? 'insufficient_funds' : 'failed',
      payment_id: payment.id,
    }, 502);

  } catch (err) {
    console.error('[lipila] fetch error:', err);
    await supabase.from('payments').update({
      status: 'failed',
      failure_reason: String(err).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id);
    return json({ error: 'Could not reach payment gateway. Please try again later.' }, 500);
  }
});
