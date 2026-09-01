import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User, Play, Upload, X } from 'lucide-react'
import { supabase, isConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { fetchUser, loginDemo } = useAuthStore()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const handleDemoLogin = () => {
    loginDemo()
    toast({ title: 'Welcome to ZedVevo Demo!' })
    navigate('/')
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' })
      return
    }

    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const onSubmit = async (data: RegisterForm) => {
    if (!isConfigured || !supabase) {
      toast({
        title: 'Demo Mode',
        description: 'Connect Supabase to enable real registration',
        variant: 'destructive',
      })
      return
    }
    setIsLoading(true)
    try {
      const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      })

      if (signUpError) {
        toast({
          title: 'Registration failed',
          description: signUpError.message,
          variant: 'destructive',
        })
        return
      }

      if (signUpData.user) {
        let avatarUrl: string | undefined

        // Upload photo if provided
        if (photoFile) {
          try {
            const fileExt = photoFile.name.split('.').pop()
            const fileName = `${signUpData.user.id}-${Date.now()}.${fileExt}`
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('avatars')
              .upload(fileName, photoFile, { upsert: true })

            if (uploadError) {
              console.error('Photo upload error:', uploadError)
              toast({ title: 'Warning', description: 'Photo upload failed, but account was created' })
            } else if (uploadData) {
              const { data: urlData } = await supabase.storage
                .from('avatars')
                .getPublicUrl(uploadData.path)
              avatarUrl = urlData.publicUrl
            }
          } catch (photoError) {
            console.error('Photo upload error:', photoError)
          }
        }

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: signUpData.user.id,
          email: data.email,
          full_name: data.fullName,
          username: data.fullName.toLowerCase().replace(/\s+/g, '_'),
          avatar_url: avatarUrl,
        })

        if (profileError) {
          console.error('Profile creation error:', profileError)
        }
      }

      await fetchUser()
      toast({ title: 'Account created successfully!' })
      navigate('/')
    } catch {
      toast({
        title: 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-b from-electric-blue/10 to-transparent">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join ZedVevo and start streaming</CardDescription>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-sm text-yellow-200">
              Demo Mode: Connect Supabase for real registration
              <Button onClick={handleDemoLogin} className="w-full mt-3" variant="outline">
                <Play className="h-4 w-4 mr-2" /> Try Demo Mode
              </Button>
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              leftIcon={<User className="h-4 w-4" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Profile Photo (Optional)
              </label>
              {photoPreview ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted mb-2">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : null}
              <label className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-gray-500 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                <Upload className="h-4 w-4" />
                <span className="text-sm">Click to upload photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG</p>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <p className="mt-4 text-xs text-gray-500 text-center">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-electric hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-electric hover:underline">Privacy Policy</Link>
          </p>

          <div className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-electric hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
