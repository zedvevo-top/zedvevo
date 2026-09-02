// Supabase Edge Function: lipila-webhook
// Nominees are auto-approved on successful payment (nomination_status = 'approved')
// ─────────────────────────────────────────────────────────────────────────────
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

// ── email helper (calls send-email edge function internally) ─────────────────
async function sendEmail(supabaseUrl: string, serviceKey: string, payload: {
  to: string; subject: string; html: string; text?: string;
}) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[webhook] sendEmail failed:', err);
    }
  } catch (e) {
    console.error('[webhook] sendEmail exception:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? '';
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

  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('id, user_id, status, payment_type, plan_id')
    .eq('id', referenceId)
    .maybeSingle();

  if (fetchErr || !payment) {
    console.error('[webhook] payment not found:', referenceId, fetchErr?.message);
    return json({ error: 'Payment not found' }, 404);
  }

  if (['successful', 'failed', 'insufficient_funds', 'cancelled'].includes(payment.status)) {
    console.log('[webhook] already terminal:', payment.status);
    return json({ received: true });
  }

  const rawStatus  = String(status ?? '').toLowerCase();
  const rawMessage = String(message ?? '');
  const isSuccess  = rawStatus === 'successful' || rawStatus === 'success';
  const isFailed   = rawStatus === 'failed' || rawStatus === 'failure';
  const isInsufficient = rawMessage.toUpperCase().includes('LOW_BALANCE') ||
    rawMessage.toLowerCase().includes('insufficient');

  let newStatus: string;
  if (isSuccess) newStatus = 'successful';
  else if (isInsufficient) newStatus = 'insufficient_funds';
  else if (isFailed) newStatus = 'failed';
  else {
    console.log('[webhook] non-terminal status:', status);
    return json({ received: true });
  }

  await supabase.from('payments').update({
    status: newStatus,
    lipila_transaction_id: identifier ?? externalId ?? null,
    failure_reason: isFailed ? rawMessage.slice(0, 400) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', referenceId);

  console.log('[webhook] payment', referenceId, '->', newStatus);

  // ── On successful/failed vote payment: update nominee total_votes ────────────
  if (payment.payment_type === 'vote') {
    const { data: pmtFull } = await supabase
      .from('payments')
      .select('metadata, user_id, amount')
      .eq('id', referenceId)
      .maybeSingle();

    const meta = pmtFull?.metadata as {
      nominee_id?: string;
      category_id?: string;
      vote_count?: number;
      user_id?: string;
    } | null;

    const nomineeId   = meta?.nominee_id ?? null;
    const voteCount   = Math.max(1, meta?.vote_count ?? 1);
    const voterId     = pmtFull?.user_id ?? meta?.user_id ?? null;

    if (nomineeId) {
      if (newStatus === 'successful') {
        // Idempotency check via vote_records table (also enforced by DB trigger,
        // but webhook is the primary path for Lipila callbacks)
        const { data: existingRecord } = await supabase
          .from('vote_records')
          .select('id')
          .eq('payment_id', referenceId)
          .maybeSingle();

        if (existingRecord) {
          console.log(`[webhook] vote already recorded for payment ${referenceId}, skipping`);
        } else {
          // Insert vote_record first — UNIQUE(payment_id) prevents double insert
          const { error: vrErr } = await supabase
            .from('vote_records')
            .insert({
              payment_id: referenceId,
              nominee_id: nomineeId,
              vote_count: voteCount,
              lipila_tx_id: identifier ?? externalId ?? null,
            });

          if (vrErr && vrErr.code === '23505') {
            // Unique violation — race condition with DB trigger, already counted
            console.log(`[webhook] vote_record unique conflict for payment ${referenceId}, already counted`);
          } else if (vrErr) {
            console.error('[webhook] vote_record insert error:', vrErr.message);
          } else {
            // vote_records inserted — DB trigger handles total_votes increment automatically
            console.log(`[webhook] vote_record inserted for nominee ${nomineeId} +${voteCount} votes`);

            // Notify voter if we have their ID
            if (voterId) {
              const { data: nomineeRow } = await supabase
                .from('nominees').select('name').eq('id', nomineeId).maybeSingle();
              await supabase.from('notifications').insert({
                user_id: voterId,
                title: '🗳️ Vote Confirmed!',
                message: `Your ${voteCount} vote${voteCount > 1 ? 's' : ''} for "${nomineeRow?.name ?? 'nominee'}" have been counted!`,
                type: 'success',
                notification_type: 'vote_confirmed',
                link: '/awards',
              });
            }
          }
        }
      } else {
        // Failed — notify voter, no votes added
        if (voterId) {
          const { data: nomineeRow } = await supabase
            .from('nominees').select('name').eq('id', nomineeId).maybeSingle();
          const failMsg = newStatus === 'insufficient_funds'
            ? `Your vote payment for "${nomineeRow?.name ?? 'nominee'}" failed: insufficient funds. Please top up and try again.`
            : `Your vote payment for "${nomineeRow?.name ?? 'nominee'}" was not processed. No votes were counted.`;
          await supabase.from('notifications').insert({
            user_id: voterId,
            title: '❌ Vote Not Counted',
            message: failMsg,
            type: 'error',
            notification_type: 'vote_failed',
            link: '/awards',
          });
        }
        console.log(`[webhook] vote ${newStatus} — no votes added for nominee: ${nomineeId}`);
      }
    } else {
      console.error('[webhook] vote payment missing nominee_id in metadata:', JSON.stringify(meta));
    }
  }

  // ── On successful nominee_registration: auto-approve nominee ────────────────
  if (newStatus === 'successful' && payment.payment_type === 'nominee_registration') {
    const { data: pmtFull } = await supabase
      .from('payments')
      .select('metadata, user_id')
      .eq('id', referenceId)
      .maybeSingle();

    const meta = pmtFull?.metadata as {
      award_id?: string;
      category_id?: string;
      nominee_name?: string;
      bio?: string;
      photo_url?: string;
      song_title?: string;
      song_url?: string;
      achievements?: string;
      social_links?: string;
      user_id?: string;
    } | null;

    const userId = pmtFull?.user_id ?? meta?.user_id ?? null;

    if (meta?.category_id && meta?.nominee_name) {
      const nomineePayload: Record<string, unknown> = {
        name: meta.nominee_name,
        category_id: meta.category_id,
        payment_id: referenceId,
        registration_status: 'successful',
        nomination_status: 'approved',   // ← auto-approved on payment
        total_votes: 0,
      };
      if (userId) nomineePayload.user_id = userId;
      if (meta.bio) nomineePayload.bio = meta.bio;
      if (meta.photo_url) nomineePayload.photo_url = meta.photo_url;
      if (meta.song_title) nomineePayload.song_title = meta.song_title;
      if (meta.song_url) nomineePayload.song_url = meta.song_url;
      if (meta.achievements) nomineePayload.achievements = meta.achievements;
      if (meta.social_links) nomineePayload.social_links = meta.social_links;

      const { data: existing } = await supabase
        .from('nominees').select('id').eq('payment_id', referenceId).maybeSingle();

      let nomId: string | null = existing?.id ?? null;
      let nomErr: { message: string } | null = null;

      if (existing) {
        // Already exists — ensure it is approved and registration marked successful
        const { error } = await supabase
          .from('nominees')
          .update({ registration_status: 'successful', nomination_status: 'approved' })
          .eq('id', existing.id);
        nomErr = error;
      } else {
        const { data: inserted, error } = await supabase
          .from('nominees').insert(nomineePayload).select('id').single();
        nomErr = error;
        nomId = inserted?.id ?? null;
      }

      if (nomErr) {
        console.error('[webhook] nominee upsert error:', nomErr.message);
      } else {
        console.log('[webhook] nominee approved:', meta.nominee_name, 'id:', nomId);

        // Notify nominator — nomination is live and approved
        if (userId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            title: '🎉 Nomination Approved & Live!',
            message: `Your nomination for "${meta.nominee_name}" has been approved and is now live on the Awards page. Voting is open!`,
            type: 'success',
            notification_type: 'nomination_approved',
            link: '/awards',
          });
        }

        // Notify all admins in-app
        const { data: admins } = await supabase
          .from('profiles').select('id').in('role', ['admin', 'super_admin']);
        if (admins && admins.length > 0) {
          await supabase.from('notifications').insert(
            admins.map(a => ({
              user_id: a.id,
              title: '🎤 New Nominee Auto-Approved',
              message: `"${meta.nominee_name}" paid and was automatically approved. They are now live on the Awards page.`,
              type: 'success',
              notification_type: 'nomination_approved',
              link: '/admin',
            }))
          );
        }

        // Email admin
        if (ADMIN_EMAIL) {
          const { data: catData } = await supabase
            .from('award_categories')
            .select('name, awards(name)')
            .eq('id', meta.category_id)
            .maybeSingle();
          const catName   = catData?.name ?? 'Unknown Category';
          const awardName = (catData?.awards as { name?: string } | null)?.name ?? 'Unknown Award';

          await sendEmail(supabaseUrl, serviceKey, {
            to: ADMIN_EMAIL,
            subject: `✅ New Nominee Auto-Approved: ${meta.nominee_name}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
                <h2 style="border-bottom:1px solid #eee;padding-bottom:12px">
                  ✅ New Nominee Auto-Approved &amp; Live
                </h2>
                <p style="color:#444;font-size:14px">
                  Payment confirmed. This nominee has been automatically approved and is now visible on the Awards page.
                </p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
                  <tr><td style="padding:8px 0;color:#666;width:140px">Nominee</td>
                      <td style="padding:8px 0;font-weight:600">${meta.nominee_name}</td></tr>
                  <tr><td style="padding:8px 0;color:#666">Award</td>
                      <td style="padding:8px 0">${awardName}</td></tr>
                  <tr><td style="padding:8px 0;color:#666">Category</td>
                      <td style="padding:8px 0">${catName}</td></tr>
                  <tr><td style="padding:8px 0;color:#666">Status</td>
                      <td style="padding:8px 0;color:#16a34a;font-weight:600">Approved ✓</td></tr>
                  ${meta.song_title ? `<tr><td style="padding:8px 0;color:#666">Song</td><td style="padding:8px 0">${meta.song_title}</td></tr>` : ''}
                  ${meta.bio ? `<tr><td style="padding:8px 0;color:#666">Bio</td><td style="padding:8px 0">${meta.bio.slice(0,200)}</td></tr>` : ''}
                  <tr><td style="padding:8px 0;color:#666">Payment ID</td>
                      <td style="padding:8px 0;font-family:monospace;font-size:12px">${referenceId}</td></tr>
                  ${nomId ? `<tr><td style="padding:8px 0;color:#666">Nominee ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px">${nomId}</td></tr>` : ''}
                </table>
                <p style="margin-top:24px">
                  <a href="${supabaseUrl}/admin"
                     style="background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
                    View in Admin Panel →
                  </a>
                </p>
              </div>
            `,
          });
        }
      }
    } else {
      console.error('[webhook] nominee_registration missing required fields. userId:', userId, 'meta:', JSON.stringify(meta));
    }
  }

  // ── On successful plan payment: promote to artist + create subscription ───
  if (newStatus === 'successful' && payment.payment_type === 'plan' && payment.plan_id) {
    const { data: plan } = await supabase
      .from('upload_plans')
      .select('plan_type, uploads_allowed, validity_days')
      .eq('id', payment.plan_id)
      .maybeSingle();

    if (plan) {
      // 1. Auto-promote/keep user as artist role (no manual admin approval needed)
      // Always set role='artist' for any paying user UNLESS they are admin/super_admin.
      // This covers: first-time buyers, renewals, and plan upgrades.
      if (payment.user_id) {
        const { error: roleErr } = await supabase
          .from('profiles')
          .update({ role: 'artist', updated_at: new Date().toISOString() })
          .eq('id', payment.user_id)
          .not('role', 'in', '("admin","super_admin")'); // never demote admins
        if (roleErr) {
          console.error('[webhook] role promote error:', roleErr.message);
        } else {
          console.log('[webhook] user set to artist:', payment.user_id);
        }

        // Notify the user their artist account is live
        await supabase.from('notifications').insert({
          user_id: payment.user_id,
          title: '🎵 Artist Account Active!',
          message: 'Your artist account is now active. Start uploading your music and videos!',
          type: 'success',
          notification_type: 'artist_activated',
          link: '/upload',
        });
      }

      // 2. Activate subscription
      const now = new Date();
      let expiresAt: string | null = null;
      if (plan.validity_days) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + plan.validity_days);
        expiresAt = exp.toISOString();
      }

      await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('user_id', payment.user_id)
        .eq('is_active', true);

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
        const { data: newSub } = await supabase
          .from('user_subscriptions').select('id')
          .eq('user_id', payment.user_id).eq('is_active', true)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (newSub) {
          await supabase.from('payments').update({ subscription_id: newSub.id }).eq('id', referenceId);
        }
      }
    }
  }

  // ── Generic payment status notification ───────────────────────────────────
  const notifMap: Record<string, { title: string; message: string; type: string; notification_type: string }> = {
    successful: {
      title: 'Payment Successful',
      message: payment.payment_type === 'nominee_registration'
        ? 'Your nomination payment was received. Your nominee is now live and approved!'
        : payment.payment_type === 'plan'
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
  if (notif && payment.user_id) {
    await supabase.from('notifications').insert({
      user_id: payment.user_id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      notification_type: notif.notification_type,
    });
  }

  // ── Notify ALL super_admins on every payment (success, failed, insufficient) ─
  if (newStatus === 'successful') {
    const { data: superAdmins } = await supabase
      .from('profiles').select('id').eq('role', 'super_admin');

    if (superAdmins && superAdmins.length > 0) {
      // Fetch user info for the notification message
      const { data: payer } = await supabase
        .from('profiles')
        .select('display_name, username, email')
        .eq('id', payment.user_id)
        .maybeSingle();
      const payerName = payer?.display_name || payer?.username || payer?.email || 'Unknown user';

      let paymentDesc = '';
      if (payment.payment_type === 'plan') {
        // Get plan name
        const { data: planRow } = await supabase
          .from('upload_plans').select('name').eq('id', payment.plan_id).maybeSingle();
        paymentDesc = `Upload plan: ${planRow?.name ?? payment.plan_id}`;
      } else if (payment.payment_type === 'nominee_registration') {
        paymentDesc = 'Nominee registration';
      } else {
        paymentDesc = payment.payment_type ?? 'Payment';
      }

      await supabase.from('notifications').insert(
        superAdmins.map(sa => ({
          user_id: sa.id,
          title: '💰 Payment Received',
          message: `${payerName} paid for ${paymentDesc} · K${payment.amount}`,
          type: 'success',
          notification_type: 'payment_received',
          link: '/admin',
        }))
      );

      // Also email super admins if ADMIN_EMAIL is set
      if (ADMIN_EMAIL) {
        await sendEmail(supabaseUrl, serviceKey, {
          to: ADMIN_EMAIL,
          subject: `💰 Payment Received: ${payerName} — K${payment.amount}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
              <h2 style="border-bottom:1px solid #eee;padding-bottom:12px">💰 Payment Received</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
                <tr><td style="padding:8px 0;color:#666;width:140px">User</td>
                    <td style="padding:8px 0;font-weight:600">${payerName}</td></tr>
                <tr><td style="padding:8px 0;color:#666">Amount</td>
                    <td style="padding:8px 0;font-weight:600">K${payment.amount}</td></tr>
                <tr><td style="padding:8px 0;color:#666">Type</td>
                    <td style="padding:8px 0">${paymentDesc}</td></tr>
                <tr><td style="padding:8px 0;color:#666">Status</td>
                    <td style="padding:8px 0;color:#16a34a;font-weight:600">Successful ✓</td></tr>
                <tr><td style="padding:8px 0;color:#666">Payment ID</td>
                    <td style="padding:8px 0;font-family:monospace;font-size:12px">${referenceId}</td></tr>
              </table>
              <p style="margin-top:24px">
                <a href="${supabaseUrl.replace('https://', 'https://app.')}/admin"
                   style="background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
                  View in Admin Panel →
                </a>
              </p>
            </div>
          `,
        });
      }
    }
  }

  return json({ received: true, status: newStatus });
});
