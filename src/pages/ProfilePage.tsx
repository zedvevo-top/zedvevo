import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import {
  User, ShieldCheck, Music, Video, Download, Heart, Award,
  Settings, LogOut, Check, Camera, Sparkles, LayoutDashboard,
  ExternalLink, Wallet, DollarSign, Users, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/store/authStore';
import { getArtistRealStatistics, updateProfile } from '@/lib/api';
import { storageService } from '@/services/storageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { formatNumber } from '@/utils';
import { toast } from 'sonner';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || profile.full_name || profile.username || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user?.id) {
      setLoadingStats(true);
      getArtistRealStatistics(user.id, user.id)
        .then((res) => setStats(res))
        .catch(() => {})
        .finally(() => setLoadingStats(false));
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <User className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Your Profile</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          Sign in or create an account to view your user profile, manage your music downloads, and customize your settings.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/login')}>Sign In</Button>
          <Button variant="outline" onClick={() => navigate('/register')}>Create Account</Button>
        </div>
      </div>
    );
  }

  const roleName = profile?.role === 'super_admin'
    ? 'Super Admin'
    : profile?.role === 'admin'
    ? 'Admin'
    : profile?.is_artist
    ? 'Verified Artist'
    : 'Listener / Member';

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        const res = await storageService.uploadProfilePicture(avatarFile, user.id);
        if (res.success && res.url) {
          avatarUrl = res.url;
        }
      }

      await updateProfile(user.id, {
        display_name: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
      });

      await refreshProfile();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error('Failed updating profile: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Profile — ZedVevo</title>
        <meta name="description" content="Manage your ZedVevo account, preferences, and artist settings." />
      </Helmet>

      <div className="min-h-screen pb-24 bg-background">
        {/* Banner Header */}
        <div className="relative h-48 md:h-60 bg-gradient-to-r from-primary/30 via-background to-accent/20 border-b border-border/40 flex items-end">
          <div className="container max-w-6xl px-4 mx-auto pb-6 relative z-10 w-full">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
              <div className="relative group">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background overflow-hidden bg-muted shadow-xl shrink-0">
                  <UserAvatar
                    src={avatarPreview || profile?.avatar_url || (user.user_metadata as any)?.avatar_url}
                    name={displayName || user.email || 'User'}
                    size="xl"
                    className="w-full h-full"
                  />
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform">
                  <Camera className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-foreground truncate">
                    {displayName || user.email?.split('@')[0] || 'Member'}
                  </h1>
                  <Badge className="bg-primary/20 text-primary border-primary/30 font-semibold text-xs">
                    {roleName}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
                  {user.email}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {profile?.is_artist && (
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <Link to={`/artist/${user.id}`}>
                      <ExternalLink className="w-4 h-4 text-primary" />
                      View Public Artist Page
                    </Link>
                  </Button>
                )}
                {(profile?.role === 'admin' || profile?.role === 'super_admin' || user.email?.toLowerCase() === 'topkuchalo@gmail.com') && (
                  <Button size="sm" asChild className="gap-1.5 bg-primary text-primary-foreground">
                    <Link to="/admin">
                      <LayoutDashboard className="w-4 h-4" />
                      Admin Control Panel
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="container max-w-6xl px-4 mx-auto pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions & Stats Sidebar */}
            <div className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Account Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground text-xs">Account Status</span>
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      ✓ Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground text-xs">Email Address</span>
                    <span className="font-semibold text-xs text-foreground truncate max-w-[160px]">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground text-xs">Member Since</span>
                    <span className="font-semibold text-xs text-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Real Stats Card */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Live Engagement Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/60">
                    <span className="text-xs text-muted-foreground">Total Followers</span>
                    <p className="text-xl font-extrabold text-foreground mt-1">
                      {formatNumber(stats?.total_followers || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/60">
                    <span className="text-xs text-muted-foreground">Total Plays</span>
                    <p className="text-xl font-extrabold text-foreground mt-1">
                      {formatNumber(stats?.total_plays || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/60">
                    <span className="text-xs text-muted-foreground">Total Likes</span>
                    <p className="text-xl font-extrabold text-rose-500 mt-1">
                      {formatNumber(stats?.total_likes || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/60">
                    <span className="text-xs text-muted-foreground">Total Earnings</span>
                    <p className="text-xl font-extrabold text-emerald-500 mt-1">
                      K{(stats?.total_earnings || 0).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Shortcut Links */}
              <Card className="border-border bg-card">
                <CardContent className="p-3 space-y-1">
                  <Button variant="ghost" className="w-full justify-start gap-3" asChild>
                    <Link to="/dashboard">
                      <LayoutDashboard className="w-4 h-4 text-primary" />
                      Dashboard & Uploads
                    </Link>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3" asChild>
                    <Link to="/downloads">
                      <Download className="w-4 h-4 text-cyan-500" />
                      My Saved Downloads
                    </Link>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3" asChild>
                    <Link to="/settings">
                      <Settings className="w-4 h-4 text-amber-500" />
                      Account Settings
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => signOut()}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out Account
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Profile Edit Form */}
            <div className="lg:col-span-2">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" /> Edit Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div>
                      <Label className="text-xs font-semibold">Display / Stage Name</Label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name or official artist name"
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        This name will appear across your music, videos, and comments.
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Username</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="e.g. mackyn2, chef187"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Bio / Artist Description</Label>
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell fans and listeners about your musical journey..."
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => refreshProfile()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reload
                      </Button>
                      <Button type="submit" disabled={saving} className="min-w-[120px] bg-primary text-primary-foreground">
                        {saving ? 'Saving...' : 'Save Profile'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
