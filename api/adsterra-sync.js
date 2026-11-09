import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client using Service Role Key to bypass RLS for ledger updates
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgugpfpotxwyoiycracf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const ADSTERRA_API_TOKEN = '7d5878b0e15f434298268a1df011fd87';
const EXCHANGE_RATE_USD_ZMW = 27.0; // Standard USD to ZMW (Zambian Kwacha) conversion rate
const ADMIN_PERCENTAGE = 20.0; // Admin commission percentage (20% share, 80% goes to artists)

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Fetch statistics from Adsterra Publisher API
    // Requesting stats grouped by date for the publisher account
    const adsterraUrl = `https://api3.adsterratools.com/publisher/stats.json?group_by=date`;
    
    let adsterraData = null;
    let fetchError = null;

    try {
      const adsterraRes = await fetch(adsterraUrl, {
        headers: {
          'X-API-Key': ADSTERRA_API_TOKEN,
          'Accept': 'application/json'
        }
      });

      if (adsterraRes.ok) {
        adsterraData = await adsterraRes.json();
      } else {
        const errorText = await adsterraRes.text();
        fetchError = `Adsterra API returned status ${adsterraRes.status}: ${errorText}`;
      }
    } catch (err) {
      fetchError = `Failed to contact Adsterra API endpoint: ${err.message}`;
    }

    // Parse the statistics returned by Adsterra
    // Response typically looks like: { "stats": [ { "date": "2026-09-23", "impressions": 1500, "clicks": 45, "ctr": 3.0, "ecpm": 1.25, "revenue": 1.875 } ] }
    let rawStats = [];
    if (adsterraData && Array.isArray(adsterraData.stats)) {
      rawStats = adsterraData.stats;
    } else if (adsterraData && typeof adsterraData === 'object') {
      // In case stats is an object or root-level array
      rawStats = Array.isArray(adsterraData) ? adsterraData : (adsterraData.data || []);
    }

    if (fetchError) {
      console.warn(fetchError);
    }

    let netNewUSD = 0;
    const syncedDays = [];
    const profitDistributions = [];

    // 2. Sync stats to database and calculate new net revenues
    for (const day of rawStats) {
      const dayDate = day.date;
      if (!dayDate) continue;

      const impressions = parseInt(day.impressions || day.views || 0);
      const clicks = parseInt(day.clicks || 0);
      const ctr = parseFloat(day.ctr || 0);
      const cpm = parseFloat(day.cpm || day.ecpm || 0);
      const revenue = parseFloat(day.revenue || 0);

      // Check if this date already exists in our stats cache
      const { data: existingDay, error: findErr } = await supabase
        .from('adsterra_stats')
        .select('*')
        .eq('date', dayDate)
        .maybeSingle();

      if (findErr) continue;

      if (!existingDay) {
        // New date: store fully and count full revenue as net new revenue
        const { error: insertErr } = await supabase
          .from('adsterra_stats')
          .insert({
            date: dayDate,
            impressions,
            clicks,
            ctr,
            cpm,
            revenue,
            updated_at: new Date().toISOString()
          });

        if (!insertErr && revenue > 0) {
          netNewUSD += revenue;
          syncedDays.push({ date: dayDate, type: 'new', revenue });
        }
      } else {
        // Existing date: calculate if there is new net revenue earned today
        const existingRevenue = parseFloat(existingDay.revenue || 0);
        const deltaRevenue = revenue - existingRevenue;

        if (deltaRevenue > 0) {
          // Update database cache
          await supabase
            .from('adsterra_stats')
            .update({
              impressions,
              clicks,
              ctr,
              cpm,
              revenue,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingDay.id);

          netNewUSD += deltaRevenue;
          syncedDays.push({ date: dayDate, type: 'update', newRevenue: deltaRevenue });
        }
      }
    }

    // Convert new revenue to Zambian Kwacha (ZMW)
    const netNewZMW = netNewUSD * EXCHANGE_RATE_USD_ZMW;
    const adminShareZMW = (netNewZMW * ADMIN_PERCENTAGE) / 100.0;
    const artistsShareZMW = netNewZMW - adminShareZMW;

    // 3. Distribute artists share based on views, play count, and downloads performance
    if (artistsShareZMW > 0) {
      // Fetch all approved content (songs and videos) with owner identifiers
      const [songsResult, videosResult, downloadsResult] = await Promise.all([
        supabase.from('songs').select('id, play_count, user_id').eq('status', 'approved'),
        supabase.from('videos').select('id, view_count, user_id').eq('status', 'approved'),
        supabase.from('downloads').select('content_id, content_type')
      ]);

      const songs = songsResult.data || [];
      const videos = videosResult.data || [];
      const downloads = downloadsResult.data || [];

      // Calculate total platform engagement scores for each artist (user_id)
      const performanceMap = {}; // user_id -> aggregate score
      let totalAggregateScore = 0;

      // Group download counts
      const downloadCounts = {};
      downloads.forEach(dl => {
        if (dl.content_id) {
          downloadCounts[dl.content_id] = (downloadCounts[dl.content_id] || 0) + 1;
        }
      });

      // Add songs performance (1 play = 1 score, 1 download = 3 score weight)
      songs.forEach(song => {
        const uId = song.user_id;
        if (!uId) return;

        const plays = parseInt(song.play_count || 0);
        const dls = parseInt(downloadCounts[song.id] || 0);
        const score = plays + (dls * 3);

        if (score > 0) {
          performanceMap[uId] = (performanceMap[uId] || 0) + score;
          totalAggregateScore += score;
        }
      });

      // Add videos performance (1 view = 2 score weight, 1 download = 5 score weight)
      videos.forEach(video => {
        const uId = video.user_id;
        if (!uId) return;

        const views = parseInt(video.view_count || 0);
        const dls = parseInt(downloadCounts[video.id] || 0);
        const score = (views * 2) + (dls * 5);

        if (score > 0) {
          performanceMap[uId] = (performanceMap[uId] || 0) + score;
          totalAggregateScore += score;
        }
      });

      // If there is aggregate engagement, perform weighted distribution
      if (totalAggregateScore > 0) {
        for (const [userId, score] of Object.entries(performanceMap)) {
          const ratio = score / totalAggregateScore;
          const payoutAmount = Math.round((artistsShareZMW * ratio) * 100) / 100; // Round to 2 decimal places

          if (payoutAmount > 0) {
            // Get or create wallet for artist
            const { data: wallet, error: walletErr } = await supabase
              .from('user_wallets')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            if (!walletErr) {
              const currentAvailable = wallet ? parseFloat(wallet.available_balance || 0) : 0;
              const currentTotal = wallet ? parseFloat(wallet.total_earnings || 0) : 0;
              const newAvailable = currentAvailable + payoutAmount;
              const newTotal = currentTotal + payoutAmount;

              if (wallet) {
                // Update existing wallet
                await supabase
                  .from('user_wallets')
                  .update({
                    available_balance: newAvailable,
                    total_earnings: newTotal,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', wallet.id);
              } else {
                // Create new wallet
                await supabase
                  .from('user_wallets')
                  .insert({
                    user_id: userId,
                    available_balance: payoutAmount,
                    total_earnings: payoutAmount,
                    pending_balance: 0,
                    total_withdrawn: 0,
                    currency: 'ZMW'
                  });
              }

              // Record transaction audit ledger
              await supabase.from('wallet_transactions').insert({
                user_id: userId,
                type: 'streaming_earnings',
                amount: payoutAmount,
                balance_before: currentAvailable,
                balance_after: newAvailable,
                status: 'completed',
                description: `Adsterra Ad Revenue Share payout: 80% shared with artists based on song plays, video views, and downloads. Adsterra sync amount: $${netNewUSD.toFixed(4)} USD.`
              });

              profitDistributions.push({
                user_id: userId,
                score,
                shareRatio: ratio,
                earnedZMW: payoutAmount
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Adsterra statistics synced and royalty earnings distributed successfully.',
      adsterra_stats_synced: syncedDays.length,
      net_new_usd: netNewUSD,
      net_new_zmw: netNewZMW,
      admin_share_zmw: adminShareZMW,
      artists_share_zmw: artistsShareZMW,
      synced_days: syncedDays,
      distributions: profitDistributions
    });

  } catch (error) {
    console.error('Adsterra syncing & payout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete Adsterra sync and profit sharing distribution.',
      details: error.message
    });
  }
}
