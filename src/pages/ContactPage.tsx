import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLScgqn9_CRNi6VbvCokvm7GRhGD9RThp0djvd0GCM1yY4b_hhw/formResponse';

const CATEGORIES = ['General Enquiry', 'Complaint', 'Feature Request', 'Other'];

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: 'General Enquiry',
    subject: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    const body = new FormData();
    body.append('entry.60107210', form.name);
    body.append('entry.1027458116', form.email);
    body.append('entry.1803847672', form.category);
    body.append('entry.1203771449', form.subject);
    body.append('entry.2120584971', form.message);

    try {
      await fetch(FORM_ACTION, {
        method: 'POST',
        mode: 'no-cors',
        body,
      });

      setSubmitted(true);
      toast.success('Message sent! We\'ll get back to you soon.');
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
            <Mail className="h-7 w-7 text-gold" />
          </div>
          <h2 className="text-editorial-md mb-3">Message Received!</h2>
          <p className="text-muted-foreground mb-6">
            Thanks for reaching out. We'll get back to you as soon as possible.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: '', email: '', category: 'General Enquiry', subject: '', message: '' }); }}>
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-10">
        <h1 className="text-editorial-md mb-2">Contact Us</h1>
        <p className="text-muted-foreground">
          Have a complaint, question, or feature idea? We'd love to hear from you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Mail className="h-4 w-4 text-gold" />
            Send us a message
          </CardTitle>
          <CardDescription>We typically respond within 24–48 hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="Brief subject of your message"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us more..."
                className="min-h-[140px]"
                required
              />
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send Message'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}