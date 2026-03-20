// src/pages/SettingsPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, HelpCircle, FileText, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';

// ── Reusable row ──────────────────────────────────────────────────────────────
function SettingRow({
  label, description, checked, onChange, disabled = false,
}: {
  label: string; description?: string;
  checked: boolean; onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="shrink-0"
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const navigate        = useNavigate();
  const { theme, setTheme } = useTheme();

  const [userId, setUserId]                         = useState<string | null>(null);
  const [loadingPrefs, setLoadingPrefs]             = useState(true);
  const [savingNotif, setSavingNotif]               = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // ── Load user + notification preference from DB ───────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) { setLoadingPrefs(false); return; }

      setUserId(user.id);

      const { data } = await supabase
        .from('profiles')
        .select('allowed_notifications')
        .eq('id', user.id)
        .maybeSingle();

      if (!mounted) return;

      // Default true if column is null (new accounts before column was added)
      setEmailNotifications(data?.allowed_notifications ?? true);
      setLoadingPrefs(false);
    })();
    return () => { mounted = false; };
  }, []);

  // ── Toggle email notifications — writes to DB ─────────────────────────────
  async function handleNotificationToggle(value: boolean) {
    if (!userId) return;
    setEmailNotifications(value); // optimistic
    setSavingNotif(true);

    const { error } = await supabase
      .from('profiles')
      .update({ allowed_notifications: value })
      .eq('id', userId);

    setSavingNotif(false);

    if (error) {
      // Revert on failure
      setEmailNotifications(!value);
      toast.error('Could not save preference. Please try again.');
    } else {
      toast.success(value ? 'Email notifications enabled' : 'Email notifications disabled');
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      <p className="text-muted-foreground mb-6">Customise your experience</p>

      {/* ── Preferences ───────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Preferences
          </CardTitle>
          <CardDescription>Manage notifications and appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Email notifications — controlled by DB */}
          {loadingPrefs ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading preferences…</span>
            </div>
          ) : (
            <SettingRow
              label="Email Notifications"
              description="Receive updates about new templates and features"
              checked={emailNotifications}
              onChange={handleNotificationToggle}
              disabled={savingNotif}
            />
          )}

          {/* Dark mode — controlled by next-themes (persists automatically) */}
          <SettingRow
            label="Dark Mode"
            description="Switch to a darker theme"
            checked={theme === 'dark'}
            onChange={checked => setTheme(checked ? 'dark' : 'light')}
          />

          {/*
            TODO: Clear cache button can be added here later to help users
            free up local storage if the app feels slow or stale.
            Implementation: clear localStorage keys prefixed with 'magzn_'
            while preserving Supabase auth tokens (keys prefixed 'sb-').
          */}

        </CardContent>
      </Card>

      {/* ── Help & Legal ──────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4" /> Help & Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-3"
            onClick={() => navigate('/faqs')}>
            <HelpCircle className="h-4 w-4" /> Help Centre
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3"
            onClick={() => navigate('/terms')}>
            <FileText className="h-4 w-4" /> Terms of Service
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3"
            onClick={() => navigate('/privacy')}>
            <Shield className="h-4 w-4" /> Privacy Policy
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3"
            onClick={() => navigate('/contact')}>
            <HelpCircle className="h-4 w-4" /> Contact Us
          </Button>
        </CardContent>
      </Card>

      {/* ── App info ──────────────────────────────────────────────────────── */}
      <div className="text-center mt-8 text-xs text-muted-foreground space-y-1">
        <p>MagznMaker v1.0.0</p>
        <p>Made with ❤️</p>
      </div>
    </div>
  );
}