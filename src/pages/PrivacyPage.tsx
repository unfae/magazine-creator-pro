export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-serif mb-6">Privacy Policy</h1>

      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>
          Your privacy matters to us. This Privacy Policy explains how we collect,
          use, and protect your information when you use MagazineMaker.
        </p>

        <h2 className="text-lg font-medium text-foreground">Information We Collect</h2>
        <p>
          When you create an account, we collect basic information such as your email
          address and authentication identifiers. Payments are processed by third-party
          payment providers, and we do not store your card or banking details.
        </p>

        <p>
          We also collect content you voluntarily upload, including images, text, and
          generated magazine layouts, solely for the purpose of providing the service.
        </p>

        <h2 className="text-lg font-medium text-foreground">How Your Content Is Used</h2>
        <p>
          Uploaded images and generated magazines are private to your account by default.
          They are not shared publicly unless you explicitly choose to publish or share
          them.
        </p>

        <p>
          We do not claim ownership of your content. You retain all rights to the images
          and magazines you create.
        </p>

        <h2 className="text-lg font-medium text-foreground">Authentication & Security</h2>
        <p>
          Authentication is handled securely via Supabase. Passwords are never stored
          directly by us. We take reasonable measures to protect your data, but no system
          can be completely secure.
        </p>

        <h2 className="text-lg font-medium text-foreground">Cookies & Analytics</h2>
        <p>
          We may use cookies or similar technologies to keep you signed in, improve
          performance, and understand how the platform is used. These do not track you
          outside the app.
        </p>

        <h2 className="text-lg font-medium text-foreground">Data Retention</h2>
        <p>
          Your data is retained for as long as your account remains active. If you delete
          your account, your personal data and content will be removed within a reasonable
          period, unless we are required to retain it by law.
        </p>

        <h2 className="text-lg font-medium text-foreground">Contact</h2>
        <p>
          If you have questions or concerns about your data or this Privacy Policy, please
          contact our support team.
        </p>
      </div>
    </div>
  );
}
