export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-serif mb-6">Terms & Conditions</h1>

      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>
          By accessing or using MagazineMaker, you agree to be bound by these Terms and
          Conditions. If you do not agree, please do not use the service.
        </p>

        <h2 className="text-lg font-medium text-foreground">Use of the Service</h2>
        <p>
          MagazineMaker allows you to upload images, edit content, and generate digital
          magazines. You are responsible for ensuring that any content you upload or
          generate complies with these terms and applicable laws.
        </p>

        <h2 className="text-lg font-medium text-foreground">Content Ownership</h2>
        <p>
          You retain full ownership of the images and magazines you upload or create. By
          using the service, you grant us a limited license to process and display your
          content solely to operate and improve the platform.
        </p>

        <h2 className="text-lg font-medium text-foreground">Prohibited Content</h2>
        <p>
          You may not upload, generate, or distribute content that is illegal, harmful,
          or abusive. This includes, but is not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Explicit sexual or pornographic content, including nude images</li>
          <li>Content that exploits or harms minors</li>
          <li>Content that infringes on intellectual property rights</li>
          <li>Hate speech, harassment, or violent content</li>
        </ul>

        <p>
          Accounts found violating these rules may be suspended or permanently terminated
          without notice.
        </p>

        <h2 className="text-lg font-medium text-foreground">Payments & Paid Templates</h2>
        <p>
          Some templates or features may require payment. All payments are processed
          through third-party providers.
        </p>

        <h2 className="text-lg font-medium text-foreground">Refund Policy</h2>
        <p>
          Refunds may be issued under the following conditions:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            The payment is confirmed as failed or incomplete by our payment provider
          </li>
          <li>
            The user did not generate any magazine, upload any images, or edit any text
            using the paid template
          </li>
          <li>
            The request is made within 7 days of the payment date
          </li>
        </ul>

        <p>
          Once a paid template has been used to generate or edit content, it is considered
          consumed and is no longer eligible for a refund.
        </p>

        <h2 className="text-lg font-medium text-foreground">Account Suspension</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms,
          misuse the platform, or attempt to exploit the system.
        </p>

        <h2 className="text-lg font-medium text-foreground">Changes to These Terms</h2>
        <p>
          These Terms and Conditions may be updated from time to time. Continued use of the
          platform after changes are made constitutes acceptance of the updated terms.
        </p>

        <h2 className="text-lg font-medium text-foreground">Contact</h2>
        <p>
          If you have any questions about these Terms, please contact our support team.
        </p>
      </div>
    </div>
  );
}
