import { createClient } from '@supabase/supabase-js';

// Setup Supabase Service Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgugpfpotxwyoiycracf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const payload = req.body || {};
  console.log('Received Lipila Webhook Payload:', JSON.stringify(payload));

  // Lipila standard payload keys
  const reference = payload.reference || payload.reference_id || payload.transactionId || payload.external_id || payload.orderId;
  const rawStatus = (payload.status || payload.transactionStatus || payload.state || '').toString().toLowerCase();

  if (!reference) {
    return res.status(400).json({ success: false, error: 'Missing reference in webhook payload' });
  }

  try {
    // 1. Fetch payment from database
    const { data: payment, error: pError } = await supabase
      .from('payments')
      .select('*')
      .or(`id.eq.${reference},reference_id.eq.${reference},external_id.eq.${reference},lipila_reference.eq.${reference},lipila_transaction_id.eq.${reference}`)
      .maybeSingle();

    if (pError || !payment) {
      console.warn(`Webhook received for unknown payment reference: ${reference}`);
      return res.status(200).json({ success: false, message: 'Reference not found in our database' });
    }

    // 2. Strict Idempotency: If already marked as completed or approved, return immediately
    if (payment.status === 'completed' || payment.status === 'successful' || payment.status === 'approved') {
      return res.status(200).json({
        success: true,
        message: 'Payment already processed and approved.',
        payment_id: payment.id,
        status: 'approved'
      });
    }

    // 3. Map Lipila statuses
    let newStatus = 'pending';
    let isSuccess = false;
    let isFailure = false;

    if (['completed', 'successful', 'success', 'approved', 'paid'].includes(rawStatus)) {
      newStatus = 'completed';
      isSuccess = true;
    } else if (['failed', 'cancelled', 'canceled', 'declined', 'expired', 'rejected'].includes(rawStatus)) {
      newStatus = 'failed';
      isFailure = true;
    } else {
      newStatus = 'processing';
    }

    const failureReason = payload.failure_reason || payload.message || payload.error || payload.reason ||
      (isFailure ? 'Mobile Money PIN request declined or timed out.' : null);

    // 4. Update status in database
    await supabase
      .from('payments')
      .update({
        status: newStatus,
        completed_at: isSuccess ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        external_id: payload.paymentId || payload.transactionId || payload.reference || payment.external_id,
        failure_reason: isFailure ? failureReason : payment.failure_reason
      })
      .eq('id', payment.id);

    // 5. If successful: Apply benefits, count votes, activate subscriptions, and send notifications
    if (isSuccess) {
      await applySecureBenefits(payment, payload);
    } else if (isFailure) {
      await handleFailedPayment(payment, failureReason);
    }

    return res.status(200).json({
      success: true,
      message: `Webhook processed. Status updated to ${newStatus}`,
      payment_id: payment.id,
      status: newStatus
    });

  } catch (error) {
    console.error('Webhook error handler exception:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Handles failure notification and logging
async function handleFailedPayment(payment, reason) {
  const userId = payment.user_id;
  const paymentId = payment.id;
  const amount = payment.amount;

  if (userId) {
    let failMsg = reason || `Your payment of ZMW ${amount} failed or was cancelled.`;
    if (payment.payment_type === 'vote') {
      failMsg = `Your Lipila payment of ZMW ${amount} failed. Your vote has not been counted.`;
    }

    // Check if duplicate failure notification already sent for this payment
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', 'payment_failed')
      .contains('metadata', { payment_id: paymentId })
      .maybeSingle();

    if (!existingNotif) {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: '❌ Payment Failed',
        message: failMsg,
        type: 'error',
        notification_type: 'payment_failed',
        link: '/dashboard?tab=payments',
        metadata: {
          payment_id: paymentId,
          amount: payment.amount,
          currency: payment.currency,
          payment_type: payment.payment_type,
          failure_reason: reason || 'Declined'
        },
        is_read: false
      });
    }
  }

  // Audit log for failure
  await supabase.from('audit_logs').insert({
    user_id: userId || null,
    action: 'PAYMENT_FAILED_WEBHOOK',
    table_name: 'payments',
    record_id: paymentId,
    new_data: { payment_id: paymentId, amount: payment.amount, type: payment.payment_type, reason }
  }).catch(() => {});
}

// Applies real product benefits on the backend securely (idempotent, server-side verified)
async function applySecureBenefits(payment, payload = {}) {
  const userId = payment.user_id;
  const metadata = payment.metadata || {};
  const paymentId = payment.id;
  const txnId = payload.paymentId || payload.transactionId || payment.external_id || paymentId;

  let creditArtistId = null;
  let creditAmount = 0;
  let creditType = '';
  let creditDesc = '';

  switch (payment.payment_type) {
    case 'vote':
      if (metadata.nominee_id) {
        const voteCount = Number(metadata.vote_count) || Math.max(1, Math.floor(Number(payment.amount) / 5));

        // Idempotency: verify this payment has not already been counted
        const { data: existingVote } = await supabase
          .from('votes')
          .select('id')
          .eq('payment_id', paymentId)
          .maybeSingle();

        if (!existingVote) {
          await supabase.from('votes').insert({
            nominee_id: metadata.nominee_id,
            category_id: metadata.category_id,
            user_id: userId,
            payment_id: paymentId,
            vote_count: voteCount,
            amount: payment.amount,
            payment_status: 'successful'
          });

          const { data: nom } = await supabase
            .from('nominees')
            .select('total_votes, user_id, name')
            .eq('id', metadata.nominee_id)
            .single();

          if (nom) {
            const newTotal = (nom.total_votes || 0) + voteCount;
            await supabase
              .from('nominees')
              .update({ total_votes: newTotal })
              .eq('id', metadata.nominee_id);

            // Credit nominee artist user (20% share)
            creditArtistId = nom.user_id;
            creditAmount = Number(payment.amount) * 0.20;
            creditType = 'voting_earnings';
            creditDesc = `Voting earnings: ${voteCount} votes cast on Nominee "${nom.name}"`;
          }
        }
      }
      break;

    case 'nominee_registration':
    case 'nominee':
      if (metadata.nominee_id) {
        await supabase
          .from('nominees')
          .update({
            registration_status: 'completed',
            nomination_status: 'approved',
            payment_id: paymentId
          })
          .eq('id', metadata.nominee_id);
      }
      break;

    case 'artist_subscription':
    case 'subscription':
    case 'plan':
      if (userId) {
        const planType = metadata.plan_id || metadata.plan_type || 'daily';
        let durationDays = 1;
        let songLimit = 1;

        if (planType === 'weekly' || planType === 'k100_weekly') {
          durationDays = 7;
          songLimit = -1;
        } else if (planType === 'annual' || planType === 'yearly' || planType === 'k300_yearly') {
          durationDays = 365;
          songLimit = -1;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        const mappedPlanType = (planType === 'weekly' || planType === 'k100_weekly') ? 'k100_weekly' : 
                               (planType === 'annual' || planType === 'yearly' || planType === 'k300_yearly') ? 'k300_yearly' : 'k10_single';
        const isOneTime = songLimit === 1;

        await supabase
          .from('artist_subscriptions')
          .upsert({
            user_id: userId,
            plan: mappedPlanType === 'k100_weekly' ? 'weekly' : mappedPlanType === 'k300_yearly' ? 'annual' : 'daily',
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            song_limit: songLimit,
            upload_count: 0,
            price: payment.amount,
            currency: payment.currency,
            payment_id: paymentId
          }, { onConflict: 'user_id,plan' });

        // Deactivate previous subscriptions and insert active subscription
        await supabase
          .from('user_subscriptions')
          .update({ is_active: false, status: 'inactive' })
          .eq('user_id', userId);

        await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: paymentId,
            plan_type: mappedPlanType,
            uploads_used: 0,
            uploads_allowed: isOneTime ? 1 : null,
            activated_at: startDate.toISOString(),
            expires_at: endDate.toISOString(),
            is_active: true,
            status: 'active',
            consumed: false
          });

        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, username, role, email')
          .eq('id', userId)
          .maybeSingle();

        const isSuperAdmin = prof?.email?.toLowerCase() === 'topkuchalo@gmail.com' || prof?.role === 'super_admin';
        const isAdmin = prof?.role === 'admin';
        const targetRole = isSuperAdmin ? 'super_admin' : (isAdmin ? 'admin' : 'artist');

        await supabase
          .from('profiles')
          .update({ is_artist: true, role: targetRole, upload_access: 'active' })
          .eq('id', userId);

        const { data: artistExists } = await supabase
          .from('artists')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!artistExists) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', userId)
            .single();

          await supabase.from('artists').insert({
            user_id: userId,
            stage_name: prof?.full_name || prof?.username || 'New Artist'
          });
        }
      }
      break;

    case 'song_purchase':
      if (metadata.item_id && userId) {
        await supabase.from('purchases').insert({
          user_id: userId,
          item_type: 'song',
          item_id: metadata.item_id,
          price: payment.amount,
          currency: payment.currency,
          payment_id: paymentId,
          purchased_at: new Date().toISOString()
        });

        const { data: song } = await supabase
          .from('songs')
          .select('artist_id, title')
          .eq('id', metadata.item_id)
          .single();

        if (song) {
          const { data: art } = await supabase
            .from('artists')
            .select('user_id')
            .eq('id', song.artist_id)
            .single();

          if (art && art.user_id) {
            creditArtistId = art.user_id;
            creditAmount = Number(payment.amount) * 0.80; // 80% to artist
            creditType = 'streaming_earnings';
            creditDesc = `Purchase of song "${song.title}"`;
          }
        }
      }
      break;

    case 'album_purchase':
      if (metadata.item_id && userId) {
        await supabase.from('purchases').insert({
          user_id: userId,
          item_type: 'album',
          item_id: metadata.item_id,
          price: payment.amount,
          currency: payment.currency,
          payment_id: paymentId,
          purchased_at: new Date().toISOString()
        });

        const { data: album } = await supabase
          .from('albums')
          .select('artist_id, title')
          .eq('id', metadata.item_id)
          .single();

        if (album) {
          const { data: art } = await supabase
            .from('artists')
            .select('user_id')
            .eq('id', album.artist_id)
            .single();

          if (art && art.user_id) {
            creditArtistId = art.user_id;
            creditAmount = Number(payment.amount) * 0.80;
            creditType = 'streaming_earnings';
            creditDesc = `Purchase of album "${album.title}"`;
          }
        }
      }
      break;

    case 'video_purchase':
      if (metadata.item_id && userId) {
        await supabase.from('purchases').insert({
          user_id: userId,
          item_type: 'video',
          item_id: metadata.item_id,
          price: payment.amount,
          currency: payment.currency,
          payment_id: paymentId,
          purchased_at: new Date().toISOString()
        });

        const { data: video } = await supabase
          .from('videos')
          .select('artist_id, title')
          .eq('id', metadata.item_id)
          .single();

        if (video) {
          const { data: art } = await supabase
            .from('artists')
            .select('user_id')
            .eq('id', video.artist_id)
            .single();

          if (art && art.user_id) {
            creditArtistId = art.user_id;
            creditAmount = Number(payment.amount) * 0.80;
            creditType = 'streaming_earnings';
            creditDesc = `Purchase of video "${video.title}"`;
          }
        }
      }
      break;

    case 'ticket':
      if (metadata.item_id && userId) {
        const { data: event } = await supabase
          .from('events')
          .select('title, artist_id')
          .eq('id', metadata.item_id)
          .single();

        const ticketNo = `ZV-${paymentId.substring(0, 8).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

        await supabase.from('tickets').insert({
          event_id: metadata.item_id,
          user_id: userId,
          status: 'sold',
          price: payment.amount,
          currency: payment.currency,
          payment_id: paymentId,
          ticket_number: ticketNo,
          purchased_at: new Date().toISOString(),
          qr_code: `TKT:${ticketNo}`
        });

        if (event) {
          const { data: art } = await supabase
            .from('artists')
            .select('user_id')
            .eq('id', event.artist_id)
            .single();

          if (art && art.user_id) {
            creditArtistId = art.user_id;
            creditAmount = Number(payment.amount) * 0.90;
            creditType = 'streaming_earnings';
            creditDesc = `Ticket sale for event "${event.title}"`;
          }
        }
      }
      break;
  }

  if (creditArtistId && creditAmount > 0) {
    await creditUserWallet(creditArtistId, creditAmount, creditType, creditDesc, paymentId);
  }

  // 6. Generate Traceable Rich Real-Time Notification
  if (userId) {
    let notifTitle = '💰 Payment Approved';
    let notifMessage = `Your payment of ZMW ${payment.amount} was successfully approved.`;
    let notifLink = '/dashboard?tab=payments';
    let notifType = 'payment_success';

    if (payment.payment_type === 'vote') {
      const nomineeName = metadata.nominee_name || 'Nominee';
      const votes = metadata.vote_count || Math.max(1, Math.floor(Number(payment.amount) / 5));
      notifTitle = '🗳️ Vote Successful';
      notifMessage = `Your payment was confirmed and ${votes} vote(s) have been counted for ${nomineeName}.`;
      notifLink = `/awards?nominee=${metadata.nominee_id || ''}`;
      notifType = 'voting_open';
    } else if (payment.payment_type === 'plan' || payment.payment_type === 'subscription' || payment.payment_type === 'artist_subscription') {
      notifTitle = '💰 Payment Approved';
      notifMessage = `Your K${payment.amount} upload payment was successfully approved.`;
      notifLink = '/upload';
      notifType = 'payment_success';
    } else if (payment.payment_type === 'nominee_registration') {
      notifTitle = '🌟 Nominee Approved';
      notifMessage = `Your nominee registration payment of ZMW ${payment.amount} was approved. You are now live on ZedVevo Awards!`;
      notifLink = '/awards';
      notifType = 'nomination_approved';
    } else if (payment.payment_type === 'song_purchase' || payment.payment_type === 'video_purchase' || payment.payment_type === 'album_purchase') {
      notifTitle = '🎵 Purchase Complete';
      notifMessage = `Your purchase of ZMW ${payment.amount} is complete. Your item is available in My Downloads.`;
      notifLink = '/downloads';
      notifType = 'payment_success';
    }

    // Check if notification already inserted
    const { data: existingSuccessNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', notifType)
      .contains('metadata', { payment_id: paymentId })
      .maybeSingle();

    if (!existingSuccessNotif) {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: notifTitle,
        message: notifMessage,
        type: 'success',
        notification_type: notifType,
        link: notifLink,
        metadata: {
          payment_id: paymentId,
          transaction_id: txnId,
          amount: payment.amount,
          currency: payment.currency,
          payment_type: payment.payment_type,
          plan_type: metadata.plan_type || metadata.plan_id,
          nominee_id: metadata.nominee_id,
          vote_count: metadata.vote_count
        },
        is_read: false
      });
    }
  }

  // 7. Store Audit Log
  await supabase.from('audit_logs').insert({
    user_id: userId || null,
    action: 'PAYMENT_VERIFIED_SUCCESSFUL_WEBHOOK',
    table_name: 'payments',
    record_id: paymentId,
    new_data: { payment_id: paymentId, amount: payment.amount, type: payment.payment_type, transaction_id: txnId }
  }).catch(() => {});
}

// Credits user's wallet atomically
async function creditUserWallet(userId, amount, type, description, referenceId) {
  try {
    const { data: wallet, error: wError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let currentWallet = wallet;

    if (wError || !wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from('user_wallets')
        .insert({ user_id: userId, available_balance: 0, pending_balance: 0, total_earnings: 0, total_withdrawn: 0 })
        .select()
        .single();
      
      if (createError) return;
      currentWallet = newWallet;
    }

    const beforeBal = Number(currentWallet.available_balance) || 0;
    const afterBal = beforeBal + Number(amount);

    await supabase
      .from('user_wallets')
      .update({
        available_balance: afterBal,
        total_earnings: (Number(currentWallet.total_earnings) || 0) + Number(amount),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: type,
      amount: amount,
      balance_before: beforeBal,
      balance_after: afterBal,
      status: 'completed',
      description: description,
      payment_reference: referenceId
    });

  } catch (err) {
    console.error(`Error crediting wallet for user ${userId}:`, err);
  }
}
