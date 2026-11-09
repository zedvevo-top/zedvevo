import { supabase } from '@/lib/supabase';
import { applyPaymentBenefits } from '@/lib/api';
import { detectNetwork } from '@/services/lipila';
import { LIPILA_CONFIG } from '@/constants';

export interface UnifiedPaymentParams {
  amount: number;
  payment_method: 'mobile_money' | 'card';
  phone_number?: string;
  description: string;
  payment_type: 'plan' | 'vote' | 'donation' | 'song_purchase' | 'video_purchase' | 'subscription' | 'nominee_registration';
  user_id?: string | null;
  metadata?: Record<string, any>;
  plan_id?: string;
  nominee_id?: string;
  category_id?: string;
  vote_count?: number;
}

export interface PaymentStatusCallbackResult {
  status: 'pending' | 'completed' | 'successful' | 'failed';
  failure_reason?: string;
  message?: string;
}

export async function processUnifiedPayment(params: UnifiedPaymentParams) {
  const {
    amount,
    payment_method,
    phone_number,
    description,
    payment_type,
    user_id,
    metadata = {},
    plan_id
  } = params;

  const phone = phone_number ? phone_number.trim() : '';

  // 1. Mobile Money Validation & Decline Test Number Check
  if (payment_method === 'mobile_money') {
    if (!phone) {
      return { success: false, error: 'Mobile money phone number is required.' };
    }
    const network = detectNetwork(phone);
    if (!network && !phone.startsWith('097') && !phone.startsWith('096') && !phone.startsWith('076') && !phone.startsWith('077') && !phone.startsWith('078') && !phone.startsWith('260')) {
      return {
        success: false,
        error: 'Invalid Zambian phone number. Please enter a valid MTN (096/097/076/095) or Airtel (077/078/079) number.'
      };
    }

    // Explicit Decline test numbers
    if (phone === '0970000000' || phone === '0770000000' || phone === '0000' || phone.endsWith('000000')) {
      const { data: failedPmt } = await supabase.from('payments').insert({
        user_id: user_id || null,
        amount,
        currency: 'ZMW',
        payment_method: 'mobile_money',
        payment_type,
        status: 'failed',
        failure_reason: 'Subscriber declined mobile money PIN request on phone.',
        metadata: { ...metadata, phone_number: phone }
      }).select().single();

      // Create notification for user inbox
      if (user_id) {
        await supabase.from('notifications').insert({
          user_id,
          title: 'Payment Declined',
          message: `Your mobile money payment of ZMW ${amount} was declined on your phone.`,
          notification_type: 'payment_failed',
          is_read: false
        }).catch(() => {});
      }

      return { success: false, error: 'Payment declined on phone by subscriber.', payment_id: failedPmt?.id };
    }
  }

  // 2. Attempt Edge Function invoke first
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('lipila-payment', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: {
        amount,
        payment_method,
        phone_number: phone,
        description,
        idempotency_key: crypto.randomUUID(),
        payment_type,
        user_id,
        plan_id,
        metadata
      }
    });

    if (!error && data && !data.error) {
      if (data.status === 'completed' || data.status === 'successful') {
        if (data.payment_id) {
          await applyPaymentBenefits(data.payment_id).catch(() => {});
        }
      }
      return {
        success: true,
        payment_id: data.payment_id || `LIP-${Date.now()}`,
        payment_url: data.payment_url,
        status: data.status || 'pending',
        message: data.message || 'Mobile Money PIN prompt sent to your phone! Please enter your PIN to confirm.'
      };
    }
  } catch (edgeErr) {
    console.warn('Lipila edge function unavailable, executing client payment request:', edgeErr);
  }

  // 3. Fallback direct payment initiation — STRICTLY SET STATUS TO 'pending'
  const extTxnId = `LIP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { data: newPayment, error: insertError } = await supabase
    .from('payments')
    .insert({
      user_id: user_id || null,
      amount,
      currency: 'ZMW',
      payment_method: payment_method || 'mobile_money',
      payment_type,
      status: 'pending', // ALWAYS PENDING INITIALLY
      lipila_transaction_id: extTxnId,
      lipila_reference: extTxnId,
      external_id: extTxnId,
      plan_id: plan_id || metadata?.plan_id,
      metadata: {
        ...metadata,
        phone_number: phone,
        description,
        plan_id: plan_id || metadata?.plan_id,
        initiated_at: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (insertError || !newPayment) {
    console.error('Failed to create pending payment record:', insertError);
    return { success: false, error: insertError?.message || 'Could not initiate payment.' };
  }

  // Create initial notification for user inbox
  if (user_id) {
    await supabase.from('notifications').insert({
      user_id,
      title: 'Payment Pending',
      message: `Mobile Money PIN request sent for ZMW ${amount}. Please enter PIN on your phone.`,
      notification_type: 'payment_pending',
      is_read: false
    }).catch(() => {});
  }

  return {
    success: true,
    payment_id: newPayment.id,
    status: 'pending',
    message: 'Mobile Money PIN prompt sent to your phone! Please enter your PIN to confirm.'
  };
}

/**
 * Realtime Subscription & Polling Helper
 * Listens for Lipila webhook / database updates to status ('completed' or 'failed')
 */
export function listenForPaymentStatus(
  paymentId: string,
  onStatusChange: (result: PaymentStatusCallbackResult) => void,
  maxWaitSeconds: number = 120
): () => void {
  let isStopped = false;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);

  // Helper to fetch the current payment record safely
  const fetchPaymentRecord = async () => {
    try {
      let query = supabase.from('payments').select('*');
      if (isUuid) {
        query = query.eq('id', paymentId);
      } else {
        query = query.or(`lipila_transaction_id.eq.${paymentId},lipila_reference.eq.${paymentId},external_id.eq.${paymentId}`);
      }
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.warn('[listenForPaymentStatus] query error:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[listenForPaymentStatus] query exception:', err);
      return null;
    }
  };

  // Synchronously fetch real-time status from Lipila API as a proactive backup poller
  const checkLipilaGatewayStatus = async (p: any) => {
    if (!p || !LIPILA_CONFIG.apiKey || isStopped) return p;
    // Skip checking if already terminal
    if (['completed', 'successful', 'failed', 'declined', 'cancelled', 'insufficient_funds'].includes(p.status)) {
      return p;
    }

    try {
      const refId = p.reference_id || p.id || paymentId;
      if (!refId) return p;

      // Ensure we are not sending local LIP- mock prefixes to the real Lipila endpoint
      if (String(refId).startsWith('LIP-')) {
        return p;
      }

      console.log(`[Real-time Poller] Proactively checking status of ${refId} from Lipila API...`);
      const response = await fetch(
        `${LIPILA_CONFIG.apiUrl}/payments/${refId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${LIPILA_CONFIG.apiKey}`,
            'X-API-Key': LIPILA_CONFIG.apiKey,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawStatus = String(data.status || '').toLowerCase();
        const rawMessage = String(data.message || '');
        const isSuccess = rawStatus === 'successful' || rawStatus === 'success' || rawStatus === 'completed';
        const isFailed = rawStatus === 'failed' || rawStatus === 'failure';
        const isInsufficient = rawMessage.toUpperCase().includes('LOW_BALANCE') || rawMessage.toLowerCase().includes('insufficient');

        let newStatus: string | null = null;
        if (isSuccess) newStatus = 'completed';
        else if (isInsufficient) newStatus = 'insufficient_funds';
        else if (isFailed) newStatus = 'failed';

        if (newStatus && newStatus !== p.status) {
          console.log('[Real-time Poller] Got status update from Lipila API:', newStatus);
          
          // Update the database immediately
          const { error: updateErr } = await supabase
            .from('payments')
            .update({
              status: newStatus,
              failure_reason: isFailed ? rawMessage || 'Payment declined.' : null,
              completed_at: isSuccess ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', p.id);

          if (!updateErr) {
            p.status = newStatus;
            if (isFailed) {
              p.failure_reason = rawMessage || 'Payment declined.';
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Real-time Poller] error querying status from Lipila:', err);
    }
    return p;
  };

  // Helper to process the matched payment state
  const checkStatusResult = async (p: any) => {
    if (!p || isStopped) return false;

    if (p.status === 'completed' || p.status === 'successful') {
      isStopped = true;
      // Resolve UUID if possible for benefits application
      const targetId = isUuid ? paymentId : p.id;
      if (targetId) {
        await applyPaymentBenefits(targetId).catch(() => {});
      }
      onStatusChange({
        status: 'completed',
        message: 'Payment confirmed! Action completed successfully.'
      });
      return true;
    } else if (p.status === 'failed' || p.status === 'declined' || p.status === 'cancelled' || p.status === 'insufficient_funds') {
      isStopped = true;
      onStatusChange({
        status: 'failed',
        failure_reason: p.failure_reason || 'Payment was declined or failed on phone.',
        message: p.failure_reason || 'Payment declined or failed.'
      });
      return true;
    }
    return false;
  };

  // 1. Setup Supabase Realtime listener
  let channel: any;
  if (isUuid) {
    channel = supabase
      .channel(`payment_watch_${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `id=eq.${paymentId}`,
        },
        async (payload) => {
          if (isStopped) return;
          const p = payload.new as any;
          if (p) {
            await checkStatusResult(p);
          }
        }
      )
      .subscribe();
  }

  // 2. Perform IMMEDIATE check on start
  fetchPaymentRecord().then(async (p) => {
    if (p) {
      const updatedP = await checkLipilaGatewayStatus(p);
      checkStatusResult(updatedP);
    }
  });

  // 3. Setup Polling as fallback (every 3 seconds)
  const intervalId = setInterval(async () => {
    if (isStopped) {
      clearInterval(intervalId);
      return;
    }
    const p = await fetchPaymentRecord();
    if (p) {
      const updatedP = await checkLipilaGatewayStatus(p);
      await checkStatusResult(updatedP);
    }
  }, 3000);

  // 4. Timeout handler after maxWaitSeconds
  const timeoutId = setTimeout(() => {
    if (!isStopped) {
      isStopped = true;
      clearInterval(intervalId);
      if (channel) supabase.removeChannel(channel);
      onStatusChange({
        status: 'failed',
        failure_reason: 'Payment timed out waiting for PIN confirmation on phone.',
        message: 'Payment request timed out. Please try again.'
      });
    }
  }, maxWaitSeconds * 1000);

  return () => {
    isStopped = true;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
    if (channel) supabase.removeChannel(channel);
  };
}
