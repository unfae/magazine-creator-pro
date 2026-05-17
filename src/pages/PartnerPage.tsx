import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Handshake, CheckCircle2 } from 'lucide-react';

const FORM_ID = '1FAIpQLSeJ6D9WZ62NNIzl9NtcR4LrkLV2MvTdT_VBUwAiRRZCUgj6ug';
const FORM_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

const FIELDS = {
  name:            'entry.60107210',
  businessName:    'entry.2133471902',
  email:           'entry.1027458116',
  phone:           'entry.1255935676',
  partnershipType: 'entry.1803847672',
  subject:         'entry.1203771449',
  message:         'entry.2120584971',
  links:           'entry.1869377256',
};

export default function PartnerPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    partnershipType: '',
    subject: '',
    message: '',
    links: '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.businessName || !form.partnershipType || !form.message) {
      toast({ title: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    const body = new URLSearchParams({
      [FIELDS.name]:            form.name,
      [FIELDS.businessName]:    form.businessName,
      [FIELDS.email]:           form.email,
      [FIELDS.phone]:           form.phone,
      [FIELDS.partnershipType]: form.partnershipType,
      [FIELDS.subject]:         form.subject,
      [FIELDS.message]:         form.message,
      [FIELDS.links]:           form.links,
    });

    try {
      await fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body });
      setSubmitted(true);
    } catch {
      toast({ title: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center text-center gap-4">
        <CheckCircle2 className="h-14 w-14 text-gold" />
        <h2 className="font-serif text-2xl font-semibold">Thanks for reaching out!</h2>
        <p className="text-muted-foreground max-w-md">
          We've received your partnership request and will get back to you within 24 hours.
        </p>
        <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: '', businessName: '', email: '', phone: '', partnershipType: '', subject: '', message: '', links: '' }); }}>
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
          <Handshake className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold">Partner With Us</h1>
          <p className="text-sm text-muted-foreground">Collaborations, sponsorships, affiliates & more</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Partnership Request</CardTitle>
          <CardDescription>Fill in the details below and we'll be in touch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Your Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Jane Doe" value={form.name} onChange={set('name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Business Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Acme Studios" value={form.businessName} onChange={set('businessName')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input placeholder="+1 234 567 8900" value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Partnership Type <span className="text-destructive">*</span></Label>
            <Select onValueChange={(v) => setForm(prev => ({ ...prev, partnershipType: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Collaboration">Collaboration</SelectItem>
                <SelectItem value="Sponsorship">Sponsorship</SelectItem>
                <SelectItem value="Affiliate">Affiliate</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input placeholder="Brief subject line" value={form.subject} onChange={set('subject')} />
          </div>

          <div className="space-y-1.5">
            <Label>Website & Social Media Links</Label>
            <Textarea
              placeholder="Share your website URL, Instagram, TikTok, or any relevant links (one per line)"
              className="min-h-[90px] resize-none"
              value={form.links}
              onChange={set('links')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tell Us More <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Describe the partnership you have in mind, your audience, goals, etc."
              className="min-h-[120px] resize-none"
              value={form.message}
              onChange={set('message')}
            />
          </div>

          <Button variant="gold" className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Sending...' : 'Submit Request'}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}