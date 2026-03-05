import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Handshake } from 'lucide-react';

const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSeJ6D9WZ62NNIzl9NtcR4LrkLV2MvTdT_VBUwAiRRZCUgj6ug/formResponse';

const PARTNERSHIP_TYPES = ['Collaboration', 'Sponsorship', 'Affiliate', 'Other'];

export default function PartnerPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    partnershipType: 'Collaboration',
    subject: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.businessName || !form.message) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    const body = new FormData();
    body.append('entry.60107210', form.name);
    body.append('entry.2133471902', form.businessName);
    body.append('entry.1027458116', form.email);
    body.append('entry.1255935676', form.phone);
    body.append('entry.1803847672', form.partnershipType);
    body.append('entry.1203771449', form.subject);
    body.append('entry.2120584971', form.message);

    try {
      await fetch(FORM_ACTION, {
        method: 'POST',
        mode: 'no-cors',
        body,
      });

      setSubmitted(true);
      toast.success('Partnership request sent! We\'ll be in touch.');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <Handshake className="h-7 w-7 text-gold" />
          </div>
          <h2 className="text-editorial-md mb-3">We'd Love to Work With You!</h2>
          <p className="text-muted-foreground mb-6">
            Thanks for your interest in partnering with us. We'll review your submission and reach out soon.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: '', businessName: '', email: '', phone: '', partnershipType: 'Collaboration', subject: '', message: '' }); }}>
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-10">
        <h1 className="text-editorial-md mb-2">Partner With Us</h1>
        <p className="text-muted-foreground">
          Interested in collaborating, sponsoring, or affiliating with MagznMaker? Let's talk.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Handshake className="h-4 w-4 text-gold" />
            Tell us about your proposal
          </CardTitle>
          <CardDescription>We're open to creative partnerships that benefit our community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name <span className="text-destructive">*</span></label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Business / Brand Name <span className="text-destructive">*</span></label>
                <Input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Your business or brand"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                <Input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Phone
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                <Input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+234..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Partnership Type</label>
              <select
                name="partnershipType"
                value={form.partnershipType}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {PARTNERSHIP_TYPES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="Brief subject of your proposal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
              <Textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us about your partnership idea, what you're proposing, and what you'd bring to the table…"
                className="min-h-[140px]"
                required
              />
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send Proposal'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}