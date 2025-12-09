import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase'; // 👈 ADDED

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let authResponse;

      if (isLogin) {
        authResponse = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
      } else {
        authResponse = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        // Create profile row on sign up
        if (!authResponse.error) {
          await supabase.from('profiles').insert({
            id: authResponse.data.user?.id,
            full_name: formData.name,
          });
        }
      }

      if (authResponse.error) {
        toast.error(authResponse.error.message);
        return;
      }

      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error('Something went wrong, please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* --- existing code unchanged below --- */}
      {/* Left Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground to-charcoal-light" />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&h=1600&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <h1 className="text-editorial-lg mb-6">
            Create stunning<br />
            <span className="italic">magazines</span><br />
            from your photos
          </h1>
          <p className="text-lg opacity-80 max-w-md">
            Transform your precious memories into beautifully designed magazine layouts with just a few clicks.
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="font-serif text-3xl font-semibold tracking-tight mb-2">
              Magzine<span className="text-gold">Maker</span>
            </h1>
            <p className="text-muted-foreground">Create beautiful photo magazines</p>
          </div>

          <Card className="border-0 shadow-elevated">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-editorial-md">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </CardTitle>
              <CardDescription>
                {isLogin 
                  ? 'Sign in to continue creating magazines' 
                  : 'Start your creative journey today'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* unchanged form layout */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-10"
                      required={!isLogin}
                    />
                  </div>
                )}
                
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground underline-animated">
                      Forgot password?
                    </Link>
                  </div>
                )}

                <Button type="submit" variant="elegant" size="lg" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {isLogin ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-1 text-foreground font-medium hover:underline"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
