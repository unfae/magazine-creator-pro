// src/pages/AuthPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { FcGoogle } from 'react-icons/fc';

export default function AuthPage() {
  const [isLogin, setIsLogin]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();

  const [bgImages, setBgImages] = useState<string[]>([]);
  const [bgIndex, setBgIndex]   = useState(0);

  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  // ── Mode from URL (?mode=login / ?mode=signup) ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode   = params.get('mode');
    if (mode === 'login')  setIsLogin(true);
    if (mode === 'signup') setIsLogin(false);
  }, [location.search]);

  // ── Background slideshow ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('templates').select('thumbnailUrl').eq('is_featured', true).limit(8);
      if (error || !mounted) return;
      const urls = (data ?? []).map((r: any) => (r.thumbnailUrl ?? '').trim()).filter(Boolean);
      if (mounted) setBgImages(urls);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (bgImages.length <= 1) return;
    const id = setInterval(() => setBgIndex(i => (i + 1) % bgImages.length), 5000);
    return () => clearInterval(id);
  }, [bgImages]);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) toast.error(error.message);
  };

  // ── Email / password ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email, password: formData.password,
        });
        if (error) throw error;
        if (!data.session) {
          toast.error('Please verify your email before signing in.');
          navigate('/check-email');
          return;
        }
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        const fullName = formData.name.trim();
        if (!fullName) {
          toast.error('Full name is required to create an account.');
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: formData.email, password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success('Check your email to verify your account');
        navigate('/check-email');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* LEFT — slideshow */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground to-charcoal-light" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="h-full flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${bgIndex * 100}%)` }}
          >
            {bgImages.map((url, i) => (
              <div
                key={url + i}
                className="h-full min-w-full shrink-0"
                style={{ backgroundImage: `url('${url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — auth card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
              <CardDescription>
                {isLogin ? 'Sign in to continue' : 'Start your creative journey'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">

              {/* Google */}
              <Button type="button" variant="outline" className="w-full gap-2" onClick={signInWithGoogle}>
                <FcGoogle size={20} />
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Email / password form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <Input
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required name="fullName" autoComplete="name"
                  />
                )}

                <Input
                  type="email" placeholder="Email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required name="email" autoComplete="email"
                />

                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      required name="password"
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Forgot password — only shown on login */}
                  {isLogin && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate('/forgot-password', {
                          state: { email: formData.email }, // pre-fill if they've typed it
                        })}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : 'Already have one?'}{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-foreground underline underline-offset-4"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}