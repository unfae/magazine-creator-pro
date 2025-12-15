export default function PrivacyPage() {
return (
<div className="container mx-auto px-4 py-12 max-w-3xl">
<h1 className="text-3xl font-serif mb-6">Privacy Policy</h1>


<div className="space-y-4 text-muted-foreground leading-relaxed">
<p>
We respect your privacy. Your personal data is only used to provide and improve the
service.
</p>


<p>
Uploaded images and generated magazines are private to your account unless you choose
to publish them.
</p>


<p>
Authentication is handled securely via Supabase. We do not store your passwords.
</p>


<p>
If you have any questions about your data, please contact support.
</p>
</div>
</div>
);
}