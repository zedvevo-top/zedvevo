import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import CDLogo from '@/components/ui/CDLogo';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPw, setShowPw] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Login form — email + password
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Google sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        toast.error(msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { toast.error('Fill in all fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) { toast.error('Enter a valid email address'); return; }
    setLoginLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: unknown) {
      const errMsg = (err as Error).message || '';
      if (errMsg.toLowerCase().includes('rate')) {
        toast.error('Too many login attempts. Please wait 60 seconds and try again.');
      } else {
        toast.error(errMsg || 'Login failed. Check your email and password.');
      }
    } finally { setLoginLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regEmail || !regPassword || !regConfirm) { toast.error('Fill in all required fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) { toast.error('Enter a valid email address'); return; }
    if (regPassword !== regConfirm) { toast.error('Passwords do not match'); return; }
    if (regPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername)) { toast.error('Username: letters, numbers and underscores only'); return; }
    setRegLoading(true);
    try {
      await signUpWithEmail(regEmail, regPassword, regUsername, regDisplayName || regUsername);
      toast.success('Account created! Welcome to ZedVevo.');
      navigate('/');
    } catch (err: unknown) {
      const errMsg = (err as Error).message || '';
      if (errMsg.toLowerCase().includes('rate')) {
        toast.error('Too many requests. Please wait 60 seconds and try again.');
      } else {
        toast.error(errMsg || 'Registration failed. Try a different username or email.');
      }
    } finally { setRegLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <CDLogo size={48} spinning />
            <h1 className="text-2xl font-bold tracking-tight">ZedVevo</h1>
          </div>
          <p className="text-sm text-muted-foreground">Zambia's music & video platform</p>
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as 'login' | 'register')}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Welcome back</CardTitle>
                <CardDescription className="text-xs">Sign in with Google or your email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 font-medium"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or with email</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      className="mt-1"
                      type="email"
                      placeholder="you@gmail.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value.trim())}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loginLoading}>
                    {loginLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create account</CardTitle>
                <CardDescription className="text-xs">Join ZedVevo today</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <Label>Username *</Label>
                    <Input
                      className="mt-1"
                      placeholder="your_username"
                      value={regUsername}
                      onChange={e => setRegUsername(e.target.value.toLowerCase())}
                      autoComplete="username"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Letters, numbers, underscores only</p>
                  </div>
                  <div>
                    <Label>Email Address *</Label>
                    <Input
                      className="mt-1"
                      type="email"
                      placeholder="you@example.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value.trim())}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label>Display Name</Label>
                    <Input className="mt-1" placeholder="Your Name" value={regDisplayName} onChange={e => setRegDisplayName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Password *</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Confirm Password *</Label>
                    <Input
                      type={showPw ? 'text' : 'password'}
                      className="mt-1"
                      placeholder="Re-enter password"
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={regLoading}>
                    {regLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
