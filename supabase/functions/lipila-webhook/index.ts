// Supabase Edge Function: lipila-webhook
// ─────────────────────────────────────────────────────────────────────────────
// Official Lipila callback payload (docs.lipila.io/docs/billing/webhook):
// {
//   referenceId: string    — YOUR payment.id (UUID sent as referenceId)
//   currency: string       — "ZMW"
//   amount: number
//   accountNumber: string  — payer mobile number
//   status: string         — "Successful" | "Failed" | "Pending"
//   paymentType: string    — "MtnMoney" | "AirtelMoney" | "ZamtelKwacha" | "Card"
//   type: string           — "Collection"
//   identifier: string     — Lipila internal ID
//   message: string        — description
//   externalId?: string    — MNO transaction ID
//   referenceData?: string — narration
// }

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase    = createClient(supabaseUrl, serviceKey);

  let payload: {
    referenceId?: string;
    currency?: string;
    amount?: number;
    accountNumber?: string;
    status?: string;
    paymentType?: string;
    type?: string;
    identifier?: string;
    message?: string;
    externalId?: string;
    referenceData?: string;
  };

  try { payload = await req.json(); }
  catch {
    console.error('[webhook] failed to parse body');
    return json({ error: 'Invalid payload' }, 400);
  }

  console.log('[webhook] received:', JSON.stringify(payload));

  const { referenceId, status, identifier, message, externalId } = payload;

  if (!referenceId) {
    console.error('[webhook] missing referenceId');
    return json({ error: 'Missing referenceId' }, 400);
  }

  // referenceId = our payment.id
  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('id, user_id, status, payment_type, plan_id, amount, metadata')
    .eq('id', referenceId)
    .maybeSingle();

  if (fetchErr || !payment) {
    console.error('[webhook] payment not found:', referenceId, fetchErr?.message);
    return json({ error: 'Payment not found' }, 404);
  }

  // Already terminal — ignore duplicate callbacks
  if (['completed', 'failed', 'insufficient_funds', 'cancelled'].includes(payment.status)) {
    console.log('[webhook] already terminal:', payment.status);
    return json({ received: true });
  }

  // Map Lipila status → our status
  const rawStatus  = String(status ?? '').toLowerCase();
  const rawMessage = String(message ?? '');
  const isSuccess  = rawStatus === 'successful' || rawStatus === 'success';
  const isFailed   = rawStatus === 'failed' || rawStatus === 'failure';
  const isInsufficient = rawMessage.toUpperCase().includes('LOW_BALANCE') ||
    rawMessage.toLowerCase().includes('insufficient');

  let newStatus: string;
  if (isSuccess) newStatus = 'completed';
  else if (isInsufficient) newStatus = 'insufficient_funds';
  else if (isFailed) newStatus = 'failed';
  else {
    console.log('[webhook] non-terminal status:', status);
    return json({ received: true });
  }

  // Update payment record
  await supabase.from('payments').update({
    status: newStatus,
    lipila_transaction_id: identifier ?? externalId ?? null,
    failure_reason: isFailed ? rawMessage.slice(0, 400) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', referenceId);

  console.log('[webhook] payment', referenceId, '->', newStatus);

  // ── On successful plan payment: create user_subscription ──────────────────
  if (newStatus === 'completed' && payment.payment_type === 'plan' && payment.plan_id) {
    const { data: plan } = await supabase
      .from('upload_plans')
      .select('plan_type, uploads_allowed, validity_days')
      .eq('id', payment.plan_id)
      .maybeSingle();

    if (plan) {
      const now = new Date();
      let expiresAt: string | null = null;
      if (plan.validity_days) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + plan.validity_days);
        expiresAt = exp.toISOString();
      }

      // Deactivate any previous active subscriptions for this user
      await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('user_id', payment.user_id)
        .eq('is_active', true);

      // Insert new active subscription — user_subscriptions is the correct table
      const { error: subErr } = await supabase.from('user_subscriptions').insert({
        user_id: payment.user_id,
        plan_id: payment.plan_id,
        plan_type: plan.plan_type,
        uploads_allowed: plan.uploads_allowed ?? null,
        uploads_used: 0,
        is_active: true,
        activated_at: now.toISOString(),
        expires_at: expiresAt,
      });

      if (subErr) {
        console.error('[webhook] subscription insert error:', subErr.message);
      } else {
        console.log('[webhook] subscription activated for user:', payment.user_id, 'plan:', plan.plan_type);
      }

      // Link payment → subscription
      const { data: newSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', payment.user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (newSub) {
        await supabase.from('payments').update({ subscription_id: newSub.id }).eq('id', referenceId);
      }
    }
  }

  if (newStatus === 'completed' && payment.payment_type === 'vote') {
    const metadata = (payment.metadata ?? {}) as { nominee_id?: string; category_id?: string; vote_count?: number };
    const voteCount = Math.max(1, Math.floor(Number(metadata.vote_count) || 1));
    if (payment.user_id && metadata.nominee_id && metadata.category_id) {
      const { error: voteError } = await supabase.from('votes').insert({
        user_id: payment.user_id,
        nominee_id: metadata.nominee_id,
        category_id: metadata.category_id,
        amount: payment.amount,
        vote_count: voteCount,
        payment_id: payment.id,
        payment_status: 'successful',
      });
      if (voteError) {
        console.error('[webhook] vote insert error:', voteError.message);
      } else {
        const { data: nominee } = await supabase.from('nominees').select('total_votes').eq('id', metadata.nominee_id).maybeSingle();
        await supabase.from('nominees').update({ total_votes: (nominee?.total_votes ?? 0) + voteCount }).eq('id', metadata.nominee_id);
      }
    }
  }

  if (newStatus === 'completed' && payment.payment_type === 'nominee_registration') {
    const metadata = (payment.metadata ?? {}) as {
      category_id?: string; nominee_name?: string; bio?: string; photo_url?: string;
      song_title?: string; song_url?: string; video_url?: string;
    };
    if (payment.user_id && metadata.category_id && metadata.nominee_name) {
      const { error: nomineeError } = await supabase.from('nominees').insert({
        user_id: payment.user_id,
        category_id: metadata.category_id,
        name: metadata.nominee_name,
        bio: metadata.bio ?? null,
        photo_url: metadata.photo_url ?? null,
        song_title: metadata.song_title ?? null,
        song_url: metadata.song_url ?? null,
        video_url: metadata.video_url ?? null,
        payment_id: payment.id,
        total_votes: 0,
        registration_status: 'successful',
        nomination_status: 'approved',
      });
      if (nomineeError) console.error('[webhook] nominee insert error:', nomineeError.message);
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifMap: Record<string, { title: string; message: string; type: string; notification_type: string }> = {
    completed: {
      title: 'Payment Successful',
      message: payment.payment_type === 'plan'
        ? 'Your upload plan is now active. Start uploading your music and videos!'
        : 'Your payment was processed successfully.',
      type: 'success',
      notification_type: 'payment_success',
    },
    failed: {
      title: 'Payment Failed',
      message: `Payment could not be processed${rawMessage ? ': ' + rawMessage : '. Please try again'}.`,
      type: 'error',
      notification_type: 'payment_failed',
    },
    insufficient_funds: {
      title: 'Insufficient Funds',
      message: 'Payment failed due to insufficient funds. Please top up your mobile money and try again.',
      type: 'error',
      notification_type: 'payment_failed',
    },
  };

  const notif = notifMap[newStatus];
  if (notif) {
    await supabase.from('notifications').insert({
      user_id: payment.user_id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      notification_type: notif.notification_type,
    });
  }

  return json({ received: true, status: newStatus });
});
