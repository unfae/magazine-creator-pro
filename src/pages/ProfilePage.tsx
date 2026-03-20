// src/pages/ProfilePage.tsx

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Camera, LogOut, Mail, User, Calendar, Phone,
  MapPin, Heart, Lock, Trash2, ChevronDown, ChevronUp, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

// ── Delete reasons ─────────────────────────────────────────────────────────────
const DELETE_REASONS = [
  "I no longer need it",
  "I found a better alternative",
  "It's too expensive",
  "I'm having technical issues",
  "Privacy concerns",
  "I created a duplicate account",
  "Other",
];

// ── Small confirm dialog ───────────────────────────────────────────────────────
function ConfirmDialog({
  open, title, children, confirmLabel, confirmClass, onConfirm, onCancel, confirmDisabled,
}: {
  open: boolean; title: string; children: React.ReactNode;
  confirmLabel: string; confirmClass?: string;
  onConfirm: () => void; onCancel: () => void;
  confirmDisabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Scroll dialog into view and lock body scroll when opened
  useEffect(() => {
    if (!open) return;
    // Small timeout lets the DOM paint first
    const t = setTimeout(() => {
      dialogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-semibold text-base">{title}</h3>
        <div className="text-sm text-muted-foreground space-y-3">{children}</div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className={confirmClass} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
      <div className="h-7 w-28 rounded bg-muted animate-pulse" />
      <div className="rounded-xl border bg-card p-6">
        <div className="flex gap-5 items-center">
          <div className="w-24 h-24 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-36 rounded bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single field row ───────────────────────────────────────────────────────────
function Field({
  icon: Icon, label, value, editing, onChange, placeholder, type = 'text', disabled = false,
}: {
  icon: React.ElementType; label: string; value: string;
  editing: boolean; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {editing && !disabled ? (
          <Input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder ?? label}
            className="h-8 text-sm"
          />
        ) : (
          <p className={`text-sm break-words ${!value ? 'text-muted-foreground italic' : ''}`}>
            {value || `No ${label.toLowerCase()} set`}
          </p>
        )}
        {disabled && editing && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Email cannot be changed here</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate    = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showExtra, setShowExtra] = useState(false);

  const [profile, setProfile]     = useState<any>(null);
  const [edited, setEdited]       = useState<any>(null);
  const [userId, setUserId]       = useState<string | null>(null);

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog]     = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [deleteReason, setDeleteReason]             = useState('');
  const [deleteOther, setDeleteOther]               = useState('');
  const [deletingAccount, setDeletingAccount]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { navigate('/auth'); return; }
      setUserId(user.id);

      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (!mounted) return;
      if (error) { toast.error('Failed to load profile'); setLoading(false); return; }

      const base = {
        full_name:        data?.full_name        ?? user.user_metadata?.full_name ?? '',
        display_name:     data?.display_name     ?? '',
        nickname:         data?.nickname         ?? '',
        email:            data?.email            ?? user.email ?? '',
        partner_name:     data?.partner_name     ?? '',
        phone:            data?.phone            ?? '',
        city:             data?.city             ?? '',
        country:          data?.country          ?? '',
        anniversary_date: data?.anniversary_date ?? '',
        birth_date:       data?.birth_date       ?? '',
        bio:              data?.bio              ?? '',
        avatar_url:       data?.avatar_url       ?? '',
        created_at:       data?.created_at       ?? user.created_at ?? '',
      };

      setProfile(base);
      setEdited(base);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // ── Avatar ─────────────────────────────────────────────────────────────────
  function handleAvatarClick() {
    if (!isEditing) return;
    fileInputRef.current?.click();
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show instant preview while we wait for save
    const preview = URL.createObjectURL(file);
    setEdited((p: any) => ({ ...p, avatar_url: preview }));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!edited || !userId) return;
    setSaving(true);

    try {
      let avatar_url = edited.avatar_url;

      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const ext  = file.name.split('.').pop() ?? 'jpg';
        const path = `avatars/${userId}_${Date.now()}.${ext}`;

        const { data: up, error: upErr } = await supabase.storage
          .from('avatars').upload(path, file, { upsert: true, contentType: file.type });

        if (upErr) {
          console.error('Avatar upload error:', upErr);
          toast.error('Avatar upload failed — profile saved without new photo');
          // Continue saving other fields even if avatar fails
        } else {
          // ✅ Correct Supabase JS v2 syntax
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(up.path);
          avatar_url = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from('profiles').update({
        full_name:        edited.full_name        || null,
        display_name:     edited.display_name     || null,
        nickname:         edited.nickname         || null,
        partner_name:     edited.partner_name     || null,
        phone:            edited.phone            || null,
        city:             edited.city             || null,
        country:          edited.country          || null,
        anniversary_date: edited.anniversary_date || null,
        birth_date:       edited.birth_date       || null,
        bio:              edited.bio              || null,
        avatar_url:       avatar_url              || null,
        updated_at:       new Date().toISOString(),
      }).eq('id', userId);

      if (error) { toast.error('Failed to save profile'); return; }

      setProfile({ ...edited, avatar_url });
      setIsEditing(false);
      // Reset file input so same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Profile saved');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword() {
    setShowPasswordDialog(false);
    const email = profile?.email;
    if (!email) { toast.error('No email on file'); return; }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) { toast.error(error.message); return; }
    toast.success('Password reset email sent — check your inbox');
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (!deleteReason) { toast.error('Please select a reason'); return; }
    if (!userId) return;

    setDeletingAccount(true);
    const finalReason = deleteReason === 'Other' ? deleteOther.trim() : deleteReason;

    try {
      // 1. Mark in DB
      await supabase.from('profiles').update({
        delete_requested:    true,
        delete_requested_at: new Date().toISOString(),
        delete_reason:       finalReason || 'Not specified',
      }).eq('id', userId);

      // 2. Open Google Form prefilled (opens in new tab, doesn't interrupt flow)
      const formUrl = buildDeleteFormUrl({
        email: profile.email,
        name:  profile.full_name || profile.display_name || '',
        reason: finalReason || 'Not specified',
      });
      if (formUrl) window.open(formUrl, '_blank', 'noopener,noreferrer');

      // 3. Sign out
      await supabase.auth.signOut();

      toast.success('Your deletion request has been submitted. We\'ll process it within 48 hours.', {
        duration: 8000,
      });
      navigate('/auth');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please contact support.');
    } finally {
      setDeletingAccount(false);
      setShowDeleteDialog(false);
    }
  }

  // ── Google Form URL builder ────────────────────────────────────────────────
  // TODO: Replace FORM_ID and entry IDs once you share your Google Form details
  function buildDeleteFormUrl({ email, name, reason }: {
    email: string; name: string; reason: string;
  }): string | null {
    const FORM_ID      = '1FAIpQLSck5s4ZLRKN4k8yWMLcJUwsjest6rxPZXfNqG9ewVQ9gC0wow';
    const EMAIL_ENTRY  = 'entry.362754775';
    const NAME_ENTRY   = 'entry.626065731';
    const REASON_ENTRY = 'entry.1304540206';

    const base = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
    const params = new URLSearchParams({
      [EMAIL_ENTRY]:  email,
      [NAME_ENTRY]:   name,
      [REASON_ENTRY]: reason,
      usp: 'pp_url',
    });
    return `${base}?${params.toString()}`;
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error('Failed to sign out'); return; }
    navigate('/auth', { replace: true });
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading || !profile) return <ProfileSkeleton />;

  const joinDate    = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';
  const displayName = profile.display_name || profile.full_name || 'Your Name';
  const initials    = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Profile</h1>
      <p className="text-muted-foreground mb-6">Manage your account information</p>

      {/* ── Avatar + name ──────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">

            {/* Avatar with clear edit icon */}
            <div className="relative shrink-0 group">
              <div
                className={`w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center transition-all
                  ${isEditing ? 'cursor-pointer ring-2 ring-primary ring-offset-2' : ''}`}
                onClick={handleAvatarClick}
              >
                {edited?.avatar_url ? (
                  <img src={edited.avatar_url} alt={displayName}
                    className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground select-none">
                    {initials}
                  </span>
                )}
                {/* Hover/edit overlay */}
                {isEditing && (
                  <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>

              {/* Pencil badge — always visible so user knows it's editable */}
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md border-2 border-background"
                  title="Change photo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-xl font-semibold truncate">{displayName}</h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </p>
              {joinDate && (
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Member since {joinDate}
                </p>
              )}
            </div>

            {/* Edit / Save / Cancel */}
            <div className="flex gap-2 shrink-0">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm"
                    onClick={() => { setIsEditing(false); setEdited(profile); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Profile details ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>Your personal information — used to autofill magazine templates</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Always-visible fields */}
          <Field icon={User}  label="Full Name"    value={edited?.full_name ?? ''}
            editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, full_name: v }))} />
          <Field icon={User}  label="Display Name" value={edited?.display_name ?? ''}
            editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, display_name: v }))}
            placeholder="What should we call you?" />
          <Field icon={Mail}  label="Email"        value={profile.email}
            editing={isEditing} onChange={() => {}} disabled />
          {/* Phone moved here — visible without expanding */}
          <Field icon={Phone} label="Phone"        value={edited?.phone ?? ''}
            editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, phone: v }))}
            type="tel" placeholder="+234 800 000 0000" />

          {/* Extra fields toggle */}
          {showExtra && (
            <>
              <Field icon={User}     label="Nickname"       value={edited?.nickname ?? ''}
                editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, nickname: v }))} />
              <Field icon={Heart}    label="Partner's Name" value={edited?.partner_name ?? ''}
                editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, partner_name: v }))} />
              <Field icon={MapPin}   label="City"           value={edited?.city ?? ''}
                editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, city: v }))} />
              <Field icon={MapPin}   label="Country"        value={edited?.country ?? ''}
                editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, country: v }))} />
              <Field icon={Calendar} label="Anniversary"    value={edited?.anniversary_date ?? ''}
                editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, anniversary_date: v }))}
                type="date" />
              <Field icon={Calendar} label="Birthday"       value={edited?.birth_date ?? ''}
                editing={isEditing} onChange={v => setEdited((p: any) => ({ ...p, birth_date: v }))}
                type="date" />

              {/* Bio — textarea */}
              <div className="flex items-start gap-3 py-3">
                <User className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Bio</p>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={edited?.bio ?? ''}
                      onChange={e => setEdited((p: any) => ({ ...p, bio: e.target.value }))}
                      placeholder="A short bio about yourself…"
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  ) : (
                    <p className={`text-sm ${!edited?.bio ? 'text-muted-foreground italic' : ''}`}>
                      {edited?.bio || 'No bio set'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowExtra(v => !v)}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gold underline underline-offset-4 decoration-gold hover:opacity-80 transition-opacity"
          >
            {showExtra
              ? <><ChevronUp className="h-4 w-4" />Show less</>
              : <><ChevronDown className="h-4 w-4" />Show more details</>}
          </button>
        </CardContent>
      </Card>

      {/* ── Account actions ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-3" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3"
            onClick={() => setShowPasswordDialog(true)}>
            <Lock className="h-4 w-4" /> Change Password
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
            onClick={() => { setDeleteReason(''); setDeleteOther(''); setShowDeleteDialog(true); }}
          >
            <Trash2 className="h-4 w-4" /> Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* ── Change password dialog ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={showPasswordDialog}
        title="Change Password"
        confirmLabel="Send Reset Email"
        onConfirm={handleChangePassword}
        onCancel={() => setShowPasswordDialog(false)}
      >
        <p>
          We'll send a password reset link to <strong>{profile.email}</strong>.
          Click it to set a new password.
        </p>
      </ConfirmDialog>

      {/* ── Delete account dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete Account"
        confirmLabel={deletingAccount ? 'Processing…' : 'Submit Deletion Request'}
        confirmClass="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteDialog(false)}
        confirmDisabled={!deleteReason || deletingAccount}
      >
        <p>
          This will permanently delete your account and all your magazines.
          Please tell us why you're leaving:
        </p>

        {/* Reason selector */}
        <div className="space-y-1.5 pt-1">
          {DELETE_REASONS.map(reason => (
            <label
              key={reason}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-foreground
                ${deleteReason === reason ? 'border-destructive bg-destructive/5' : 'border-border hover:border-muted-foreground'}`}
            >
              <input
                type="radio"
                name="deleteReason"
                value={reason}
                checked={deleteReason === reason}
                onChange={() => setDeleteReason(reason)}
                className="accent-destructive"
              />
              <span className="text-sm">{reason}</span>
            </label>
          ))}
        </div>

        {/* "Other" free text */}
        {deleteReason === 'Other' && (
          <textarea
            rows={2}
            value={deleteOther}
            onChange={e => setDeleteOther(e.target.value)}
            placeholder="Please tell us more…"
            className="w-full mt-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </ConfirmDialog>
    </div>
  );
}