import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/use-toast'
import { storageService } from '@/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import { Camera, Save, BellRing, Volume2, Smartphone, HelpCircle, Loader2 } from 'lucide-react'
import { playNotificationChime, requestAdminNotificationPermission, getAdminNotificationPermission } from '@/services/adminNotificationService'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { profile, avatarUrl, displayName, updateProfile: saveUserProfile } = useUserProfile()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [fullName, setFullName] = useState(profile?.display_name || (user as any)?.full_name || '')
  const [username, setUsername] = useState(profile?.username || user?.username || '')
  const [bio, setBio] = useState(profile?.bio || user?.bio || '')

  useEffect(() => {
    if (profile) {
      setFullName(profile.display_name || (user as any)?.full_name || '')
      setUsername(profile.username || '')
      setBio(profile.bio || '')
    }
  }, [profile, user])

  // Custom device notification sound & permission state
  const [soundType, setSoundType] = useState(localStorage.getItem('zedvevo_notification_sound') || 'iphone')
  const [notificationPermission, setNotificationPermission] = useState(getAdminNotificationPermission())

  const handleSoundChange = (type: string) => {
    localStorage.setItem('zedvevo_notification_sound', type);
    setSoundType(type);
    if (type !== 'none') {
      setTimeout(() => {
        playNotificationChime(type as 'iphone' | 'samsung');
      }, 100);
      toast({
        title: `Sound updated: ${type === 'iphone' ? 'iOS Tri-Tone' : 'Samsung Galaxy Bubbly'}`,
        description: 'Chime sound is active. Tap the test button to listen again.'
      });
    } else {
      toast({
        title: 'Notifications Silent',
        description: 'Chime sound has been disabled.'
      });
    }
  };

  const handleRequestPushPermission = async () => {
    const res = await requestAdminNotificationPermission();
    setNotificationPermission(res);
    if (res === 'granted') {
      toast({
        title: 'Push Notifications Active',
        description: 'Sticky pop-up messages are successfully authorized on your device.'
      });
    } else {
      toast({
        title: 'Permission Denied',
        description: 'Please enable notifications manually inside your browser settings to receive sticky OS pop-ups.',
        variant: 'destructive'
      });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetId = profile?.id || user?.id
    if (!file || !targetId) return

    try {
      setIsLoading(true)
      const result = await storageService.uploadProfilePicture(file, targetId)
      if (result.error) throw new Error(result.error)
      if (!result.url) throw new Error('Failed to retrieve upload URL')

      await saveUserProfile({ avatar_url: result.url })
      toast({ title: 'Avatar updated successfully' })
    } catch (error) {
      toast({
        title: 'Error uploading avatar',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await saveUserProfile({
        display_name: fullName,
        username,
        bio,
      })
      toast({ title: 'Profile updated successfully' })
    } catch {
      toast({ title: 'Error updating profile', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-electric-blue/10 to-transparent py-12">
        <div className="container px-4">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Manage your account and preferences</p>
        </div>
      </div>

      <div className="container px-4 py-8 max-w-2xl">
        {/* Profile Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <UserAvatar
                  name={fullName || displayName || 'User'}
                  src={avatarUrl}
                  size="xl"
                  className="w-24 h-24"
                />
                <label className="absolute bottom-0 right-0 p-2 bg-accent rounded-full cursor-pointer hover:bg-accent/80 transition-colors shadow-md">
                  <Camera className="h-4 w-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
              <div>
                <p className="text-white font-medium text-lg">{fullName || displayName || 'Your Name'}</p>
                <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
                {profile?.role && (
                  <span className="inline-block mt-1 text-[11px] font-semibold bg-accent/15 text-accent px-2 py-0.5 rounded uppercase">
                    {profile.role.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full h-24 px-4 py-2 rounded-lg border border-border bg-dark-gray/50 text-white placeholder:text-gray-500 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20"
                placeholder="Tell us about yourself..."
              />
            </div>

            <Button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </CardContent>
        </Card>

         {/* Account Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border">
              <div>
                <p className="text-white font-medium">Email</p>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border">
              <div>
                <p className="text-white font-medium">Password</p>
                <p className="text-sm text-gray-400">Last changed: Never</p>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>
            <div className="flex justify-between items-center py-3">
              <div>
                <p className="text-white font-medium">Role</p>
                <p className="text-sm text-gray-400 capitalize">{user?.role || 'user'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Notifications & Custom Sounds */}
        <Card className="mb-8 border-accent/20 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-accent" />
              <CardTitle>Device Notifications & Sounds</CardTitle>
            </div>
            <CardDescription>
              Select your preferred chime sound and activate sticky push notifications for real-time votes and uploads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Sound Chime Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-accent" /> Notification Sound Profile
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'iphone', label: 'Apple iPhone', desc: 'iOS Tri-Tone' },
                  { id: 'samsung', label: 'Samsung Galaxy', desc: 'Bubbly Horizon' },
                  { id: 'none', label: 'None (Silent)', desc: 'No Sound Chime' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSoundChange(s.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-20 ${
                      soundType === s.id
                        ? 'border-accent bg-accent/10 text-white shadow-md shadow-accent/5'
                        : 'border-border bg-dark-gray/20 hover:bg-dark-gray/40 text-gray-400'
                    }`}
                  >
                    <span className="text-xs font-bold text-white block">{s.label}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold block">{s.desc}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 mt-2">
                <span className="text-xs text-muted-foreground">Test selected alert chime locally:</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={soundType === 'none'}
                  onClick={() => playNotificationChime(soundType as 'iphone' | 'samsung')}
                  className="text-xs h-8 border-accent/40 text-accent hover:bg-accent/10 font-bold"
                >
                  🔊 Play Test Sound
                </Button>
              </div>
            </div>

            {/* Native OS Sticky Push Authorization */}
            <div className="space-y-3 border-t border-white/5 pt-5">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-accent" /> Native Device Push Alert
              </label>

              <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">
                    Device Permission: {' '}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
                      notificationPermission === 'granted' ? 'bg-emerald-950 text-emerald-300' :
                      notificationPermission === 'denied' ? 'bg-red-950 text-red-300' :
                      'bg-amber-950 text-amber-300'
                    }`}>
                      {notificationPermission}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-normal max-w-sm">
                    Enabling device notifications lets real-time upload & voting alerts "stick" to your lockscreen, status drawer, or browser as high-priority push events.
                  </p>
                </div>

                <div className="shrink-0">
                  {notificationPermission === 'granted' ? (
                    <Button disabled variant="outline" size="sm" className="w-full text-xs h-9 border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                      Active & Connected
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleRequestPushPermission} 
                      size="sm" 
                      className="w-full text-xs h-9 bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-md shadow-accent/10"
                    >
                      Authorize Device Push
                    </Button>
                  )}
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Artist Section */}
        {user?.is_artist && (
          <Card>
            <CardHeader>
              <CardTitle>Artist Settings</CardTitle>
              <CardDescription>Manage your artist profile</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => window.location.href = '/artist'}>
                Go to Artist Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
