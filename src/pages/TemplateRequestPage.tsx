import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSchilg4HeeX6c_EHKCC6F3R2DWADszO3Dw6SEVqsllsQrYrmg/formResponse';

const REQUEST_TYPES = ['New Template', 'New Page to Existing Template'];

export default function TemplateRequestPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    requestType: 'New Template',
    templateName: '',
    description: '',
    referenceLinks: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    const body = new FormData();
    body.append('entry.60107210', form.name);
    body.append('entry.1027458116', form.email);
    body.append('entry.1803847672', form.requestType);
    body.append('entry.1203771449', form.templateName);
    body.append('entry.2120584971', form.description);
    body.append('entry.1460892771', form.referenceLinks);

    try {
      await fetch(FORM_ACTION, {
        method: 'POST',
        mode: 'no-cors',
        body,
      });

      setSubmitted(true);
      toast.success('Request submitted! We\'ll review it shortly.');
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
            <Sparkles className="h-7 w-7 text-gold" />
          </div>
          <h2 className="text-editorial-md mb-3">Request Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Thanks for your idea! We review all requests and will reach out if we need more details.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: '', email: '', requestType: 'New Template', templateName: '', description: '', referenceLinks: '' }); }}>
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-10">
        <h1 className="text-editorial-md mb-2">Request a Template</h1>
        <p className="text-muted-foreground">
          Don't see what you're looking for? Request a new template or a new page for an existing one.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Sparkles className="h-4 w-4 text-gold" />
            Tell us what you need
          </CardTitle>
          <CardDescription>The more detail you give, the better we can build it for you.</CardDescription>
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
              <label className="text-sm font-medium">Request Type</label>
              <select
                name="requestType"
                value={form.requestType}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {REQUEST_TYPES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Template Name
                <span className="text-muted-foreground font-normal ml-1">(if adding a page to existing)</span>
              </label>
              <Input
                name="templateName"
                value={form.templateName}
                onChange={handleChange}
                placeholder="e.g. Elegance, Wanderlust…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the template or page you'd like — theme, style, purpose, layout ideas…"
                className="min-h-[140px]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Reference Links
                <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              </label>
              <Input
                name="referenceLinks"
                value={form.referenceLinks}
                onChange={handleChange}
                placeholder="Any inspiration links, Pinterest boards, etc."
              />
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}