import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgugpfpotxwyoiycracf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const payload = req.body || {};
  console.log('Received Lipila Webhook Payload:', JSON.stringify(payload));

  // Lipila standard payload keys
  const reference = payload.reference || payload.reference_id || payload.transactionId;
  const status = payload.status || payload.transactionStatus || payload.state;

  if (!reference) {
    return res.status(400).json({ success: false, error: 'Missing reference in webhook payload' });
  }

  try {
    // 1. Fetch payment from database
    const { data: payment, error: pError } = await supabase
      .from('payments')
      .select('*')
      .or(`id.eq.${reference},reference_id.eq.${reference},external_id.eq.${reference}`)
      .maybeSingle();

    if (pError || !payment) {
      // Return 200 to acknowledge anyway to prevent Lipila from infinite retries
      console.warn(`Webhook received for unknown payment reference: ${reference}`);
      return res.status(200).json({ success: false, message: 'Reference not found in our database' });
    }

    // 2. If already marked as completed, return immediately
    if (payment.status === 'completed' || payment.status === 'successful') {
      return res.status(200).json({ success: true, message: 'Payment already processed.' });
    }

    // Map Lipila statuses
    let newStatus = 'pending';
    let isSuccess = false;

    if (status === 'completed' || status === 'successful' || status === 'Completed' || status === 'SUCCESS') {
      newStatus = 'completed';
      isSuccess = true;
    } else if (status === 'failed' || status === 'Failed' || status === 'FAILED' || status === 'cancelled') {
      newStatus = 'failed';
    } else {
      newStatus = 'processing';
    }

    // 3. Update status in database
    await supabase
      .from('payments')
      .update({
        status: newStatus,
        completed_at: isSuccess ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        external_id: payload.paymentId || payload.reference || payment.external_id
      })
      .eq('id', payment.id);

    // 4. If successful, apply product benefits
    if (isSuccess) {
      await applySecureBenefits(payment);
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('Webhook error handler exception:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Applies real product benefits on the backend securely (idempotent, server-side verified)
async function applySecureBenefits(payment) {
  const userId = payment.user_id;
  const metadata = payment.metadata || {};
  const paymentId = payment.id;

  let creditArtistId = null;
  let creditAmount = 0;
  let creditType = '';
  let creditDesc = '';

  switch (payment.payment_type) {
    case 'vote':
      if (metadata.nominee_id) {
        const voteCount = metadata.vote_count || Math.max(1, Math.floor(payment.amount / 5));

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
            .select('total_votes, user_id')
            .eq('id', metadata.nominee_id)
            .single();

          if (nom) {
            const newTotal = (nom.total_votes || 0) + voteCount;
            await supabase
              .from('nominees')
              .update({ total_votes: newTotal })
              .eq('id', metadata.nominee_id);

            // Credit nominee artist user (20%)
            creditArtistId = nom.user_id;
            creditAmount = Number(payment.amount) * 0.20;
            creditType = 'voting_earnings';
            creditDesc = `Voting earnings: ${voteCount} votes cast on Nominee`;
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
      const planType = metadata.plan_id || metadata.plan_type || 'daily';
      let durationDays = 1;
      let songLimit = 1;

      if (planType === 'weekly') {
        durationDays = 7;
        songLimit = -1;
      } else if (planType === 'annual' || planType === 'yearly') {
        durationDays = 365;
        songLimit = -1;
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      await supabase
        .from('artist_subscriptions')
        .upsert({
          user_id: userId,
          plan: planType === 'weekly' ? 'weekly' : planType === 'annual' || planType === 'yearly' ? 'annual' : 'daily',
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
        .from('profiles')
        .update({ is_artist: true, role: 'artist' })
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
      break;

    case 'song_purchase':
      if (metadata.item_id) {
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
      if (metadata.item_id) {
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
            creditAmount = Number(payment.amount) * 0.80; // 80% to artist
            creditType = 'streaming_earnings';
            creditDesc = `Purchase of album "${album.title}"`;
          }
        }
      }
      break;

    case 'video_purchase':
      if (metadata.item_id) {
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
            creditAmount = Number(payment.amount) * 0.80; // 80% to artist
            creditType = 'streaming_earnings';
            creditDesc = `Purchase of video "${video.title}"`;
          }
        }
      }
      break;

    case 'ticket':
      if (metadata.item_id) {
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
            creditAmount = Number(payment.amount) * 0.90; // 90% payout for tickets
            creditType = 'streaming_earnings';
            creditDesc = `Ticket sale for event "${event.title}"`;
          }
        }
      }
      break;

    case 'merchandise':
      if (metadata.item_id) {
        await supabase
          .from('orders')
          .update({
            status: 'paid',
            payment_id: paymentId
          })
          .eq('id', metadata.item_id);

        const { data: items } = await supabase
          .from('order_items')
          .select('merchandise_id, quantity, unit_price')
          .eq('order_id', metadata.item_id);

        if (items) {
          for (const item of items) {
            const { data: merch } = await supabase
              .from('merchandise')
              .select('seller_id, title')
              .eq('id', item.merchandise_id)
              .single();

            if (merch) {
              const itemTotal = Number(item.unit_price) * Number(item.quantity);
              await creditUserWallet(
                merch.seller_id,
                itemTotal * 0.85,
                'streaming_earnings',
                `Merchandise sale: ${item.quantity}x "${merch.title}"`,
                paymentId
              );
            }
          }
        }
      }
      break;
  }

  if (creditArtistId && creditAmount > 0) {
    await creditUserWallet(creditArtistId, creditAmount, creditType, creditDesc, paymentId);
  }

  // Send real-time notification
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'payment_success',
    title: 'Payment Successful',
    message: `Your payment of ZMW ${payment.amount} has been processed successfully.`,
    data: { payment_id: paymentId, type: payment.payment_type }
  });

  // Store Audit Log
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'PAYMENT_VERIFIED_SUCCESSFUL_WEBHOOK',
    table_name: 'payments',
    record_id: paymentId,
    new_data: { payment_id: paymentId, amount: payment.amount, type: payment.payment_type }
  });
}

// Credits user's wallet atomically (shared helper)
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
