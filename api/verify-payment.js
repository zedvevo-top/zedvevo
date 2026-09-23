import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgugpfpotxwyoiycracf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const LIPILA_API_KEY = process.env.VITE_LIPILA_API_KEY || '';
const LIPILA_API_URL = 'https://api.lipila.com/v1';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { paymentId, reference } = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const targetId = paymentId || reference;

  if (!targetId) {
    return res.status(400).json({ success: false, error: 'Missing paymentId or reference' });
  }

  try {
    // 1. Fetch payment from database
    const { data: payment, error: pError } = await supabase
      .from('payments')
      .select('*')
      .or(`id.eq.${targetId},reference_id.eq.${targetId},lipila_reference.eq.${targetId},lipila_transaction_id.eq.${targetId},external_id.eq.${targetId}`)
      .maybeSingle();

    if (pError || !payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    // If already marked as completed or approved, return success immediately (Idempotent)
    if (payment.status === 'completed' || payment.status === 'successful' || payment.status === 'approved') {
      return res.status(200).json({
        success: true,
        status: 'completed',
        amount: payment.amount,
        payment_id: payment.id,
        message: 'Payment was already verified and completed.'
      });
    }

    // If already marked as failed, return failed status
    if (payment.status === 'failed') {
      return res.status(200).json({
        success: false,
        status: 'failed',
        amount: payment.amount,
        payment_id: payment.id,
        failure_reason: payment.failure_reason || 'Payment failed or was declined.',
        message: payment.failure_reason || 'Payment failed or was declined.'
      });
    }

    let isSuccess = false;
    let isFailure = false;
    let actualStatus = payment.status || 'pending';
    let failureReason = null;
    let externalTxnId = payment.external_id;

    // Check decline test numbers
    const phone = payment.metadata?.phone_number || '';
    if (phone === '0970000000' || phone === '0770000000' || phone === '0000' || phone.endsWith('000000')) {
      actualStatus = 'failed';
      isFailure = true;
      failureReason = 'Subscriber declined Mobile Money PIN request on mobile device.';
    } else if (LIPILA_API_KEY && (payment.reference_id || payment.lipila_reference || payment.external_id)) {
      // Call Lipila API to verify payment status securely
      const lipilaRef = payment.reference_id || payment.lipila_reference || payment.external_id;
      try {
        const lipilaResponse = await fetch(`${LIPILA_API_URL}/payments/${lipilaRef}/status`, {
          headers: {
            'Authorization': `Bearer ${LIPILA_API_KEY}`,
            'X-API-Key': LIPILA_API_KEY,
          },
        });

        if (lipilaResponse.ok) {
          const lipilaData = await lipilaResponse.json();
          const lStatus = (lipilaData.status || lipilaData.transactionStatus || '').toLowerCase();
          
          if (['completed', 'successful', 'success', 'approved', 'paid'].includes(lStatus)) {
            isSuccess = true;
            actualStatus = 'completed';
            externalTxnId = lipilaData.transactionId || lipilaData.paymentId || externalTxnId;
          } else if (['failed', 'cancelled', 'canceled', 'declined', 'expired', 'rejected'].includes(lStatus)) {
            isFailure = true;
            actualStatus = 'failed';
            failureReason = lipilaData.message || lipilaData.reason || 'Transaction declined by mobile operator.';
          } else {
            actualStatus = 'processing';
          }
        }
      } catch (err) {
        console.warn('Error querying Lipila API status:', err);
      }
    }

    // If status updated, update payment record
    if (actualStatus !== payment.status) {
      await supabase
        .from('payments')
        .update({
          status: actualStatus,
          completed_at: isSuccess ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
          failure_reason: isFailure ? failureReason : payment.failure_reason,
          external_id: externalTxnId
        })
        .eq('id', payment.id);

      if (isSuccess) {
        // Apply benefits and send notification
        await applySecureBenefits(payment, { paymentId: externalTxnId });
      } else if (isFailure) {
        await handleFailedPayment(payment, failureReason);
      }
    }

    return res.status(200).json({
      success: isSuccess,
      status: actualStatus,
      amount: payment.amount,
      payment_id: payment.id,
      failure_reason: failureReason,
      message: isSuccess
        ? 'Payment verified successfully.'
        : isFailure
        ? (failureReason || 'Payment failed.')
        : 'Payment is pending mobile money authorization. Please check your phone for PIN prompt.'
    });

  } catch (error) {
    console.error('Payment verification exception:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Applies real product benefits on the backend securely (idempotent, server-side verified)
async function applySecureBenefits(payment, payload = {}) {
  const userId = payment.user_id;
  const metadata = payment.metadata || {};
  const paymentId = payment.id;
  const txnId = payload.paymentId || payment.external_id || paymentId;

  let creditArtistId = null;
  let creditAmount = 0;
  let creditType = '';
  let creditDesc = '';

  switch (payment.payment_type) {
    case 'vote':
      if (metadata.nominee_id) {
        const voteCount = Number(metadata.vote_count) || Math.max(1, Math.floor(Number(payment.amount) / 5));

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

        await supabase
          .from('profiles')
          .update({ is_artist: true, role: 'artist', upload_access: 'active' })
          .eq('id', userId);
      }
      break;

    case 'song_purchase':
    case 'video_purchase':
    case 'album_purchase':
      if (metadata.item_id && userId) {
        const itemType = payment.payment_type.replace('_purchase', '');
        await supabase.from('purchases').insert({
          user_id: userId,
          item_type: itemType,
          item_id: metadata.item_id,
          price: payment.amount,
          currency: payment.currency,
          payment_id: paymentId,
          purchased_at: new Date().toISOString()
        });
      }
      break;
  }

  if (creditArtistId && creditAmount > 0) {
    await creditUserWallet(creditArtistId, creditAmount, creditType, creditDesc, paymentId);
  }

  // Send Notification
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
      notifMessage = `Your nominee registration payment of ZMW ${payment.amount} was approved.`;
      notifLink = '/awards';
      notifType = 'nomination_approved';
    }

    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', notifType)
      .contains('metadata', { payment_id: paymentId })
      .maybeSingle();

    if (!existingNotif) {
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
          plan_type: metadata.plan_type || metadata.plan_id
        },
        is_read: false
      });
    }
  }
}

async function handleFailedPayment(payment, reason) {
  const userId = payment.user_id;
  const paymentId = payment.id;
  const amount = payment.amount;

  if (userId) {
    let failMsg = reason || `Your payment of ZMW ${amount} failed or was declined.`;
    if (payment.payment_type === 'vote') {
      failMsg = `Your Lipila payment failed. Your vote has not been counted.`;
    }

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
}

async function creditUserWallet(userId, amount, type, description, referenceId) {
  try {
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let currentWallet = wallet;
    if (!wallet) {
      const { data: newWallet } = await supabase
        .from('user_wallets')
        .insert({ user_id: userId, available_balance: 0, pending_balance: 0, total_earnings: 0, total_withdrawn: 0 })
        .select()
        .single();
      currentWallet = newWallet;
    }
    if (!currentWallet) return;

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
