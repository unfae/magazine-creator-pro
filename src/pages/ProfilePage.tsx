import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Mail, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type ProfileState = {
  name: string;
  email: string;
  avatarUrl: string;
  joinedDate: string;
};

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [editedProfile, setEditedProfile] = useState<ProfileState | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ------------------------------------------------------------------ */
  /* Fetch authenticated user + profile                                  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to view your profile');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!mounted) return;

      const resolvedProfile: ProfileState = {
        name: data?.full_name ?? 'Unnamed User',
        email: user.email ?? '',
        avatarUrl:
          data?.avatar_url ??
          'https://ui-avatars.com/api/?name=User&background=EEE&color=555',
        joinedDate: data?.created_at
          ? new Date(data.created_at).toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })
          : '',
      };

      setProfile(resolvedProfile);
      setEditedProfile(resolvedProfile);
      setLoading(false);
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, []);

 

  /* ------------------------------------------------------------------ */
  /* Save profile                                                        */
  /* ------------------------------------------------------------------ */
  const handleSave = async () => {
    if (!editedProfile) return;

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

      const fileInput = fileInputRef.current;
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } =
          await supabase.storage
            .from('magazine-assets')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true,
            });

        if (uploadError) {
          toast.error('Failed to upload avatar');
          setLoading(false);
          return;
        }

        const { publicUrl } = supabase.storage
          .from('magazine-assets')
          .getPublicUrl(uploadData.path);

        avatarUrl = publicUrl;
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: editedProfile.name,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        toast.error('Failed to update profile');
        setLoading(false);
        return;
      }

      const updated = { ...editedProfile, avatarUrl };
      setProfile(updated);
      setEditedProfile(updated);
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Avatar click                                                        */
  /* ------------------------------------------------------------------ */
  const handleAvatarButton = () => {
    if (!isEditing) return;
    fileInputRef.current?.click();
  };

  if (loading || !profile || !editedProfile) {
    return <div className="container mx-auto px-4 py-12">Loading…</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-editorial-lg mb-2">Profile</h1>
      <p className="text-muted-foreground mb-8">Manage your account information</p>

      {/* Profile Card */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary">
                <img
                  src={editedProfile.avatarUrl}
                  alt={editedProfile.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <button
                onClick={handleAvatarButton}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gold text-primary-foreground flex items-center justify-center shadow-soft"
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
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, name: e.target.value })
                      }
                      className="pl-10"
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

    

      {/* Account */}
      <Card>
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
