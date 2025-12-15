import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Mail, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<any>(null);
  const [editedProfile, setEditedProfile] = useState<any>(null);

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
        toast.error('You must be signed in');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
        toast.error('Failed to load profile');
        setLoading(false);
        return;
      }

      if (!mounted) return;

      const formatted = {
        name: data.full_name ?? '',
        email: data.email ?? user.email ?? '',
        avatarUrl: data.avatar_url ?? '',
        joinedDate: data.created_at
          ? new Date(data.created_at).toLocaleDateString()
          : '',
      };

      setProfile(formatted);
      setEditedProfile(formatted);
      setLoading(false);
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAvatarButton = () => {
    if (!isEditing) return;
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    if (!editedProfile) return;

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in');
        setLoading(false);
        return;
      }

      let avatarUrl = editedProfile.avatarUrl;

      // Upload avatar if changed
      if (fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        const filePath = `avatars/${user.id}_${Date.now()}`;

        const { data: uploadData, error: uploadError } =
          await supabase.storage
            .from('magazine-assets')
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
          console.error(uploadError);
          toast.error('Avatar upload failed');
          setLoading(false);
          return;
        }

        const { publicUrl } = supabase.storage
          .from('magazine-assets')
          .getPublicUrl(uploadData.path);

        avatarUrl = publicUrl;
      }

      const { error } = await supabase.from('profiles').update({
        full_name: editedProfile.name,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (error) {
        console.error(error);
        toast.error('Failed to update profile');
        setLoading(false);
        return;
      }

      setProfile({ ...editedProfile, avatarUrl });
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return <div className="container py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-editorial-lg mb-2">Profile</h1>
      <p className="text-muted-foreground mb-8">Manage your account information</p>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">

            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>

              <button
                onClick={handleAvatarButton}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gold text-primary-foreground flex items-center justify-center"
              >
                <Camera className="h-4 w-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const preview = URL.createObjectURL(e.target.files[0]);
                    setEditedProfile({ ...editedProfile, avatarUrl: preview });
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
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, name: e.target.value })
                      }
                      className="pl-10"
                      placeholder="Full name"
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={editedProfile.email}
                      disabled
                      className="pl-10"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-serif text-2xl mb-1">{profile.name}</h2>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {profile.email}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    Member since {profile.joinedDate}
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedProfile(profile);
                    }}
                  >
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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            Change Password
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive"
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
