import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function CheckEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const resendVerification = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Verification email sent. Check your inbox.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-editorial-md">Check your email</h1>

        <p className="text-muted-foreground">
          We’ve sent you a verification link. Please check your inbox and click
          the link to activate your account.
        </p>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="If you didn't get the email, Enter your email again"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button
            onClick={resendVerification}
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Sending…' : 'Resend verification email'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Didn’t get the email? Check spam or try resending.
        </p>
      </div>
    </div>
  );
}
