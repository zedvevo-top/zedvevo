// Artist Service - Manages artist subscriptions and uploads
import { supabase, isConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { ARTIST_PLANS } from '@/constants'
import { lipilaService } from './lipila'
import { generateId } from '@/utils'

export interface ArtistSubscription {
  id: string
  user_id: string
  plan: 'daily' | 'weekly' | 'annual'
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  start_date: string
  end_date: string
  song_limit: number
  upload_count: number
  price: number
  currency: string
}

class ArtistService {
  // Check if user can upload (has active subscription or is admin)
  async canUpload(): Promise<boolean> {
    if (!isConfigured) {
      return false
    }

    const user = useAuthStore.getState().user
    if (!user) {
      return false
    }

    // Admins and super admins can always upload free
    if (user.role === 'super_admin' || user.role === 'admin') {
      return true
    }

    // Only artists can upload (after payment)
    if (user.role !== 'artist') {
      return false
    }

    // Check for active subscription
    const { data: subscription } = await supabase
      .from('artist_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .single()

    if (!subscription) {
      return false
    }

    // Check upload limit based on plan
    // K10: 1 song per plan (expires after 1 upload)
    // K100: unlimited for 7 days
    // K300: unlimited for 1 year
    if (subscription.song_limit !== -1 && subscription.upload_count >= subscription.song_limit) {
      return false
    }

    return true
  }

  // Get user's active subscription
  async getActiveSubscription(): Promise<ArtistSubscription | null> {
    if (!isConfigured) {
      return null
    }

    const user = useAuthStore.getState().user
    if (!user) {
      return null
    }

    const { data } = await supabase
      .from('artist_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .single()

    return data
  }

  // Get all user's subscriptions
  async getSubscriptions(): Promise<ArtistSubscription[]> {
    if (!isConfigured) {
      return []
    }

    const user = useAuthStore.getState().user
    if (!user) {
      return []
    }

    const { data } = await supabase
      .from('artist_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return data || []
  }

  // Subscribe to artist plan using Lipila
  async subscribeToPlan(
    planType: 'daily' | 'weekly' | 'annual',
    phoneNumber: string
  ): Promise<{ success: boolean; error?: string; paymentId?: string }> {
    if (!isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    const user = useAuthStore.getState().user
    if (!user) {
      return { success: false, error: 'Please login first' }
    }

    const plan = ARTIST_PLANS[planType]
    if (!plan) {
      return { success: false, error: 'Invalid plan selected' }
    }

    try {
      // First, ensure user has artist capability and artist record
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single()

      const isSuper = profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'topkuchalo@gmail.com'
      const isAdmin = profile?.role === 'admin'
      const targetRole = isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'artist')

      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: targetRole, is_artist: true, upload_access: 'active' })
        .eq('id', user.id)

      if (roleError) {
        return { success: false, error: 'Failed to set artist permissions' }
      }

      // Create artist record if not exists
      const { data: existingArtist } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existingArtist) {
        await supabase.from('artists').insert({
          user_id: user.id,
          stage_name: user.full_name || user.username || 'Artist',
        })
      }

      // Create payment via Lipila with auto-activation
      const result = await lipilaService.subscribeArtist(planType, plan.price, phoneNumber, user.id)

      return result
    } catch (error: any) {
      console.error('Subscription error:', error)
      return { success: false, error: error.message || 'Failed to create subscription' }
    }
  }

  // Activate artist subscription after successful payment
  async activateSubscription(paymentId: string, planType: 'daily' | 'weekly' | 'annual'): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    const user = useAuthStore.getState().user
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const plan = ARTIST_PLANS[planType]
      if (!plan) {
        return { success: false, error: 'Invalid plan' }
      }

      const now = new Date()
      let endDate = new Date(now)
      
      // Set end date based on plan type
      if (planType === 'daily') {
        endDate.setDate(endDate.getDate() + 1)
      } else if (planType === 'weekly') {
        endDate.setDate(endDate.getDate() + 7)
      } else if (planType === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1)
      }

      // Create active subscription
      const { data: subscription, error: subError } = await supabase
        .from('artist_subscriptions')
        .insert({
          user_id: user.id,
          plan: planType,
          status: 'active',
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          song_limit: plan.songLimit,
          upload_count: 0,
          price: plan.price,
          currency: plan.currency || 'ZMW',
          payment_id: paymentId,
        })
        .select()
        .single()

      if (subError || !subscription) {
        return { success: false, error: 'Failed to create subscription' }
      }

      // Update profile to artist if not already
      await supabase
        .from('profiles')
        .update({ 
          is_artist: true, 
          role: 'artist',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      // Create artist record if not exists
      const { data: existingArtist } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!existingArtist) {
        await supabase.from('artists').insert({
          user_id: user.id,
          stage_name: user.full_name || user.username || 'Artist',
        })
      }

      // Create success notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'success',
        title: 'Subscription Activated',
        message: `Your ${plan.name} plan has been activated successfully. You can now upload ${plan.songLimit === -1 ? 'unlimited' : plan.songLimit} ${plan.songLimit === 1 ? 'song' : 'songs'}.`,
        data: {
          subscriptionId: subscription.id,
          plan: planType,
          uploadLimit: plan.songLimit
        }
      })

      // Refresh auth state
      await useAuthStore.getState().fetchUser()

      return { success: true }
    } catch (error: any) {
      console.error('Subscription activation error:', error)
      return { success: false, error: error.message }
    }
  }

  // Expire subscription after upload for K10 plan
  async expireSubscriptionIfNeeded(subscriptionId: string): Promise<void> {
    if (!isConfigured) return

    const { data: subscription } = await supabase
      .from('artist_subscriptions')
      .select('plan, song_limit, upload_count')
      .eq('id', subscriptionId)
      .single()

    if (!subscription) return

    // For K10 plan (daily): expire after 1 upload
    if (subscription.plan === 'daily' && subscription.upload_count >= 1) {
      await supabase
        .from('artist_subscriptions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
    }
  }

  // Increment upload count
  async incrementUploadCount(subscriptionId: string): Promise<void> {
    if (!isConfigured) return

    await supabase.rpc('increment', {
      table_name: 'artist_subscriptions',
      row_id: subscriptionId,
      column_name: 'upload_count',
    })
  }

  // Get upload stats
  async getUploadStats(): Promise<{
    totalUploads: number
    limit: number
    remaining: number
    daysLeft: number
  }> {
    if (!isConfigured) {
      return { totalUploads: 0, limit: 0, remaining: 0, daysLeft: 0 }
    }

    const user = useAuthStore.getState().user
    if (!user) {
      return { totalUploads: 0, limit: 0, remaining: 0, daysLeft: 0 }
    }

    const subscription = await this.getActiveSubscription()
    if (!subscription) {
      return { totalUploads: 0, limit: 0, remaining: 0, daysLeft: 0 }
    }

    const endDate = new Date(subscription.end_date)
    const now = new Date()
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      totalUploads: subscription.upload_count,
      limit: subscription.song_limit === -1 ? -1 : subscription.song_limit,
      remaining: subscription.song_limit === -1 ? -1 : Math.max(0, subscription.song_limit - subscription.upload_count),
      daysLeft: Math.max(0, daysLeft),
    }
  }

  // Grant upload access to user (admin only)
  async grantUploadAccess(userId: string, planType: 'daily' | 'weekly' | 'annual'): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    const admin = useAuthStore.getState().user
    if (!admin || (admin.role !== 'super_admin' && admin.role !== 'admin')) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const plan = ARTIST_PLANS[planType]
      if (!plan) {
        return { success: false, error: 'Invalid plan' }
      }

      // Ensure user has artist capability without downgrading super_admin/admin
      const { data: prof } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', userId)
        .maybeSingle()

      const isSuper = prof?.role === 'super_admin' || prof?.email?.toLowerCase() === 'topkuchalo@gmail.com'
      const isAdmin = prof?.role === 'admin'
      const targetRole = isSuper ? 'super_admin' : (isAdmin ? 'admin' : 'artist')

      await supabase
        .from('profiles')
        .update({ role: targetRole, is_artist: true, upload_access: 'active' })
        .eq('id', userId)

      const now = new Date()
      let endDate = new Date(now)
      
      if (planType === 'daily') {
        endDate.setDate(endDate.getDate() + 1)
      } else if (planType === 'weekly') {
        endDate.setDate(endDate.getDate() + 7)
      } else if (planType === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1)
      }

      // Create subscription
      const { error: subError } = await supabase
        .from('artist_subscriptions')
        .insert({
          user_id: userId,
          plan: planType,
          status: 'active',
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          song_limit: plan.songLimit,
          upload_count: 0,
          price: 0, // Admin grant = free
          currency: 'ZMW',
        })

      if (subError) {
        return { success: false, error: subError.message }
      }

      // Create notification for user
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'success',
        title: 'Upload Access Granted by Admin',
        message: `Admin has granted you ${plan.name} plan access. You can now upload.`,
        data: { plan: planType }
      })

      return { success: true }
    } catch (error: any) {
      console.error('Grant access error:', error)
      return { success: false, error: error.message }
    }
  }

  // Upload song with auto-approval after successful payment
  async uploadSong(songData: {
    title: string
    description?: string
    audioFile: File
    coverImage?: File
    genre?: string
    price?: number
    isFree?: boolean
  }): Promise<{ success: boolean; error?: string; songId?: string }> {
    if (!isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    // Check upload permission
    const canUpload = await this.canUpload()
    if (!canUpload) {
      return { success: false, error: 'Please subscribe to an artist plan to upload songs' }
    }

    const user = useAuthStore.getState().user
    const artist = useAuthStore.getState().artist
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const subscription = await this.getActiveSubscription()

    try {
      const songId = generateId()

      // Upload audio file
      const audioPath = `songs/${user.id}/${songId}/${songData.audioFile.name}`
      const { error: audioError } = await supabase.storage
        .from('music')
        .upload(audioPath, songData.audioFile)

      if (audioError) {
        return { success: false, error: 'Failed to upload audio file' }
      }

      const { data: audioUrl } = supabase.storage.from('music').getPublicUrl(audioPath)

      // Upload cover image if provided
      let coverUrl: string | null = null
      if (songData.coverImage) {
        const coverPath = `covers/${user.id}/${songId}/${songData.coverImage.name}`
        await supabase.storage.from('albums').upload(coverPath, songData.coverImage)
        const { data: url } = supabase.storage.from('albums').getPublicUrl(coverPath)
        coverUrl = url.publicUrl
      }

      // Admins can auto-approve, artists need admin review
      const status = (user.role === 'super_admin' || user.role === 'admin') ? 'approved' : 'pending'

      // Create song record
      const { error: songError } = await supabase.from('songs').insert({
        id: songId,
        title: songData.title,
        description: songData.description,
        artist_id: artist?.id,
        cover_url: coverUrl,
        audio_url: audioUrl.publicUrl,
        duration: 0,
        genre: songData.genre,
        price: songData.isFree ? 0 : songData.price || 0,
        access: songData.isFree ? 'free' : 'premium',
        status: status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (songError) {
        await supabase.storage.from('music').remove([audioPath])
        return { success: false, error: songError.message }
      }

      // Increment upload count if artist has subscription
      if (subscription) {
        await this.incrementUploadCount(subscription.id)
        await this.expireSubscriptionIfNeeded(subscription.id)
      }

      // Create notification based on role
      if (user.role === 'super_admin' || user.role === 'admin') {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'success',
          title: 'Song Uploaded Successfully',
          message: `Your song "${songData.title}" has been uploaded and auto-approved.`,
          data: { songId, status: 'approved' }
        })
      } else {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'info',
          title: 'Song Upload Successful - Awaiting Admin Review',
          message: `Your song "${songData.title}" has been successfully uploaded. Please wait for our admin team to review your content within 24 hours.`,
          data: {
            songId,
            songTitle: songData.title,
            pendingReview: true,
            reviewWaitTime: '24 hours'
          }
        })
      }

      await useAuthStore.getState().fetchUser()

      return { success: true, songId }
    } catch (error: any) {
      console.error('Upload error:', error)
      return { success: false, error: error.message }
    }
  }

  // Upload video
  async uploadVideo(videoData: {
    title: string
    description?: string
    videoFile: File
    thumbnail?: File
    price?: number
    isFree?: boolean
  }): Promise<{ success: boolean; error?: string; videoId?: string }> {
    if (!isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    const canUpload = await this.canUpload()
    if (!canUpload) {
      return { success: false, error: 'Please subscribe to an artist plan to upload videos' }
    }

    const user = useAuthStore.getState().user
    const artist = useAuthStore.getState().artist
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const videoId = generateId()

      // Upload video file
      const videoPath = `videos/${user.id}/${videoId}/${videoData.videoFile.name}`
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoPath, videoData.videoFile)

      if (videoError) {
        return { success: false, error: 'Failed to upload video file' }
      }

      const { data: videoUrl } = supabase.storage.from('videos').getPublicUrl(videoPath)

      // Upload thumbnail if provided
      let thumbnailUrl: string | null = null
      if (videoData.thumbnail) {
        const thumbPath = `thumbnails/${user.id}/${videoId}/${videoData.thumbnail.name}`
        await supabase.storage.from('images').upload(thumbPath, videoData.thumbnail)
        const { data: url } = supabase.storage.from('images').getPublicUrl(thumbPath)
        thumbnailUrl = url.publicUrl
      }

      const status = (user.role === 'super_admin' || user.role === 'admin') ? 'approved' : 'pending'

      // Create video record
      const { error } = await supabase.from('videos').insert({
        id: videoId,
        title: videoData.title,
        description: videoData.description,
        artist_id: artist?.id,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl.publicUrl,
        duration: 0,
        price: videoData.isFree ? 0 : videoData.price || 0,
        access: videoData.isFree ? 'free' : 'premium',
        status: status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // Create notification
      if (user.role === 'super_admin' || user.role === 'admin') {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'success',
          title: 'Video Uploaded Successfully',
          message: `Your video "${videoData.title}" has been uploaded and auto-approved.`,
          data: { videoId, status: 'approved' }
        })
      } else {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'info',
          title: 'Video Upload Successful - Awaiting Admin Review',
          message: `Your video "${videoData.title}" has been successfully uploaded. Please wait for our admin team to review your content within 24 hours.`,
          data: {
            videoId,
            videoTitle: videoData.title,
            pendingReview: true,
            reviewWaitTime: '24 hours'
          }
        })
      }

      return { success: true, videoId }
    } catch (error: any) {
      console.error('Video upload error:', error)
      return { success: false, error: error.message }
    }
  }

  // Create album
  async createAlbum(albumData: {
    title: string
    description?: string
    coverImage: File
    genre?: string
    price?: number
    isFree?: boolean
  }): Promise<{ success: boolean; error?: string; albumId?: string }> {
    if (!isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    const canUpload = await this.canUpload()
    if (!canUpload) {
      return { success: false, error: 'Please subscribe to an artist plan to create albums' }
    }

    const user = useAuthStore.getState().user
    const artist = useAuthStore.getState().artist
    if (!user || !artist) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const albumId = generateId()

      // Upload cover image
      const coverPath = `covers/${user.id}/${albumId}/${albumData.coverImage.name}`
      const { error: coverError } = await supabase.storage
        .from('albums')
        .upload(coverPath, albumData.coverImage)

      if (coverError) {
        return { success: false, error: 'Failed to upload cover image' }
      }

      const { data: coverUrl } = supabase.storage.from('albums').getPublicUrl(coverPath)

      // Create album record
      const { error } = await supabase.from('albums').insert({
        id: albumId,
        title: albumData.title,
        artist_id: artist.id,
        cover_url: coverUrl.publicUrl,
        description: albumData.description,
        genre: albumData.genre,
        price: albumData.isFree ? 0 : albumData.price || 0,
        access: albumData.isFree ? 'free' : 'premium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, albumId }
    } catch (error: any) {
      console.error('Album creation error:', error)
      return { success: false, error: error.message }
    }
  }
}

export const artistService = new ArtistService()
export default artistService
