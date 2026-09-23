import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isConfigured, clearStaleAuthStorage, type Profile, type Artist } from '@/lib/supabase'
import { ADMIN_EMAIL, isAdminEmail } from '@/lib/authHelpers'

interface AuthState {
  user: Profile | null
  artist: Artist | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isArtist: boolean
  demoMode: boolean
  setUser: (user: Profile | null) => void
  setArtist: (artist: Artist | null) => void
  setLoading: (loading: boolean) => void
  fetchUser: () => Promise<void>
  fetchArtist: () => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  promoteToSuperAdmin: () => Promise<void>
  loginDemo: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      artist: null,
      isLoading: true,
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
      isArtist: false,
      demoMode: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isAdmin: user?.role === 'super_admin' || user?.role === 'admin' || (user?.email ? isAdminEmail(user.email) : false),
          isSuperAdmin: user?.role === 'super_admin' || (user?.email ? isAdminEmail(user.email) : false),
          isArtist: user?.role === 'artist' || user?.is_artist || false,
        }),

      setArtist: (artist) => set({ artist }),

      setLoading: (isLoading) => set({ isLoading }),

      loginDemo: () => {
        const demoUser: Profile = {
          id: 'demo-user-id',
          email: 'admin@zedvevo.com',
          full_name: 'Admin User',
          username: 'admin',
          avatar_url: null,
          bio: 'ZedVevo Administrator',
          role: 'super_admin',
          is_artist: true,
          is_verified: true,
          social_links: {},
          preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        }
        set({
          user: demoUser,
          isAuthenticated: true,
          isAdmin: true,
          isSuperAdmin: true,
          isArtist: true,
          demoMode: true,
          isLoading: false,
        })
      },

      fetchUser: async () => {
        if (!isConfigured || !supabase) {
          set({ isLoading: false })
          return
        }
        try {
          const {
            data: { user: supabaseUser },
            error: userError,
          } = await supabase.auth.getUser()

          if (userError) {
            const msg = (userError.message || '').toLowerCase()
            if (msg.includes('refresh token') || msg.includes('not found') || msg.includes('invalid_grant')) {
              clearStaleAuthStorage()
              await supabase.auth.signOut().catch(() => {})
            }
            set({
              user: null,
              isAuthenticated: false,
              isAdmin: false,
              isSuperAdmin: false,
              isArtist: false,
            })
            return
          }

          if (supabaseUser) {
            let { data: profile, error: profileErr } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', supabaseUser.id)
              .maybeSingle()

            if (profileErr && (profileErr.code === 'PGRST303' || profileErr.message?.includes('JWT issued at future'))) {
              await new Promise((res) => setTimeout(res, 1000))
              const retry = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUser.id)
                .maybeSingle()
              if (!retry.error) {
                profile = retry.data
              }
            }

            const isOwner = profile?.email?.toLowerCase() === 'topkuchalo@gmail.com' || (profile?.username && profile.username.toLowerCase() === 'topkuchalo')
            if (isOwner && profile?.role !== 'super_admin') {
              const { data: updatedProfile } = await supabase
                .from('profiles')
                .update({ role: 'super_admin', is_artist: true, upload_access: 'active' })
                .eq('id', profile.id)
                .select()
                .maybeSingle()
              
              set({
                user: updatedProfile || { ...profile, role: 'super_admin', is_artist: true, upload_access: 'active' },
                isAuthenticated: true,
                isAdmin: true,
                isSuperAdmin: true,
                isArtist: true,
              })
              return
            }

            set({
              user: profile,
              isAuthenticated: true,
              isAdmin: profile?.role === 'super_admin' || profile?.role === 'admin',
              isSuperAdmin: profile?.role === 'super_admin',
              isArtist: profile?.role === 'artist' || profile?.is_artist || profile?.role === 'super_admin' || profile?.role === 'admin' || false,
            })
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isAdmin: false,
              isSuperAdmin: false,
              isArtist: false,
            })
          }
        } catch (error) {
          console.error('Error fetching user:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      fetchArtist: async () => {
        const user = get().user
        if (!user || !supabase) return

        try {
          const { data: artist } = await supabase
            .from('artists')
            .select('*')
            .eq('user_id', user.id)
            .single()

          set({ artist })
        } catch (error) {
          console.error('Error fetching artist:', error)
        }
      },

      logout: async () => {
        if (supabase) {
          await supabase.auth.signOut()
        }
        set({
          user: null,
          artist: null,
          isAuthenticated: false,
          isAdmin: false,
          isSuperAdmin: false,
          isArtist: false,
          demoMode: false,
        })
      },

      updateProfile: async (updates) => {
        const user = get().user
        if (!user || !supabase) return

        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single()

        if (error) throw error

        set({ 
          user: data,
          isAdmin: data?.role === 'super_admin' || data?.role === 'admin',
          isSuperAdmin: data?.role === 'super_admin',
          isArtist: data?.role === 'artist' || data?.is_artist || data?.role === 'super_admin' || data?.role === 'admin' || false,
        })
      },

      promoteToSuperAdmin: async () => {
        const user = get().user
        if (!user || !supabase) return

        if (!get().isSuperAdmin) {
          throw new Error('Only super admin can promote users')
        }

        const { data, error } = await supabase
          .from('profiles')
          .update({ role: 'super_admin' })
          .eq('id', user.id)
          .select()
          .single()

        if (error) throw error

        set({ 
          user: data,
          isAdmin: true,
          isSuperAdmin: true,
        })
      },
    }),
    {
      name: 'zedvevo-auth',
      partialize: (state) => ({
        user: state.user,
        artist: state.artist,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        isSuperAdmin: state.isSuperAdmin,
        isArtist: state.isArtist,
        demoMode: state.demoMode,
      }),
    }
  )
)
