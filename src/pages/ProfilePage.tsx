import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Mail, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<any>({
    name: 'Alex Morgan',
    email: 'alex@example.com',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    joinedDate: 'January 2024',
  });

  const [editedProfile, setEditedProfile] = useState(profile);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to view profile');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // keep defaults if profile not found
        setLoading(false);
        return;
      }

      if (!mounted) return;

      const formatted = {
        name: data.full_name ?? data.fullName ?? profile.name,
        email: user.email ?? profile.email,
        avatarUrl: data.avatar_url ?? profile.avatarUrl,
        joinedDate: data.created_at ? new Date(data.created_at).toLocaleDateString() : profile.joinedDate,
      };

      setProfile(formatted);
      setEditedProfile(formatted);
      setLoading(false);
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = {
    magazines: 12,
    drafts: 3,
    favorites: 5,
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to update profile');
        setLoading(false);
        return;
      }

      let avatarUrl = editedProfile.avatarUrl;

      // If a file was selected in the hidden input, upload it
      const fileInput = fileInputRef.current;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('magazine-assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          toast.error('Failed to upload avatar');
          setLoading(false);
          return;
        }

        const { publicUrl } = supabase.storage.from('magazine-assets').getPublicUrl(uploadData.path);
        avatarUrl = publicUrl ?? avatarUrl;
      }

      // Upsert profile row
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: editedProfile.name,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      });

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile');
        setLoading(false);
        return;
      }

      setProfile({ ...editedProfile, avatarUrl });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong saving profile');
    } finally {
      setLoading(false);
    }
  };

  // Trigger file input when camera button is clicked (only when editing)
  const handleAvatarButton = () => {
    if (!isEditing) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="animate-fade-in">
        <h1 className="text-editorial-lg mb-2">Profile</h1>
        <p className="text-muted-foreground mb-8">Manage your account information</p>
      </div>

      {/* Profile Card */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary">
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={handleAvatarButton}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gold text-primary-foreground flex items-center justify-center shadow-soft hover:bg-gold/90 transition-colors"
              >
                <Camera className="h-4 w-4" />
              </button>
              {/* hidden file input for avatar */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    // show preview locally immediately
                    const url = URL.createObjectURL(e.target.files[0]);
                    setEditedProfile({ ...editedProfile, avatarUrl: url });
                  }
                }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              {isEditing ? (
                <div className="space-y-3 max-w-sm">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={editedProfile.name}
                      onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                      className="pl-10"
                      placeholder="Full Name"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                      className="pl-10"
                      placeholder="Email"
                      type="email"
                      disabled
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-serif text-2xl mb-1">{profile.name}</h2>
                  <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-2">
                    <Mail className="h-4 w-4" />
                    {profile.email}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    Member since {profile.joinedDate}
                  </p>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setIsEditing(false); setEditedProfile(profile); }}>
                    Cancel
                  </Button>
                  <Button variant="gold" onClick={handleSave} disabled={loading}>
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-serif font-semibold text-gold">{stats.magazines}</p>
            <p className="text-sm text-muted-foreground">Magazines</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-serif font-semibold">{stats.drafts}</p>
            <p className="text-sm text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-serif font-semibold">{stats.favorites}</p>
            <p className="text-sm text-muted-foreground">Favorites</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
