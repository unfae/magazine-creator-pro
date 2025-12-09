import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, Moon, Download, HelpCircle, FileText, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    notifications: true,
    emailUpdates: false,
    darkMode: false,
    autoSave: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings({ ...settings, [key]: !settings[key] });
    toast.success('Settings updated');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="animate-fade-in">
        <h1 className="text-editorial-lg mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">Customize your app experience</p>
      </div>

      {/* Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferences
          </CardTitle>
          <CardDescription>Manage notifications and app behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-muted-foreground">Receive alerts about your magazines</p>
            </div>
            <Switch
              checked={settings.notifications}
              onCheckedChange={() => handleToggle('notifications')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Updates</p>
              <p className="text-sm text-muted-foreground">Get updates about new templates</p>
            </div>
            <Switch
              checked={settings.emailUpdates}
              onCheckedChange={() => handleToggle('emailUpdates')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-save Drafts</p>
              <p className="text-sm text-muted-foreground">Automatically save your progress</p>
            </div>
            <Switch
              checked={settings.autoSave}
              onCheckedChange={() => handleToggle('autoSave')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look of the app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Switch to dark theme</p>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={() => handleToggle('darkMode')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data & Storage
          </CardTitle>
          <CardDescription>Manage your data and downloads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Export All Magazines
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
            Clear Cache
          </Button>
        </CardContent>
      </Card>

      {/* Help & Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help & Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="ghost" className="w-full justify-start">
            <HelpCircle className="h-4 w-4 mr-2" />
            Help Center
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Terms of Service
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Shield className="h-4 w-4 mr-2" />
            Privacy Policy
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <div className="text-center mt-8 text-sm text-muted-foreground">
        <p>MagzineMaker v1.0.0</p>
        <p>Made with ❤️</p>
      </div>
    </div>
  );
}
