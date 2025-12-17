import { MailCheck } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center">
            <MailCheck className="h-7 w-7 text-gold" />
          </div>
        </div>

        <h1 className="text-editorial-md mb-3">
          Verify your email
        </h1>

        <p className="text-muted-foreground mb-6">
          We’ve sent a verification link to your email address.
          Please check your inbox and click the link to activate your account.
        </p>

        <p className="text-sm text-muted-foreground">
          Didn’t get the email? Check your spam folder or try signing up again Thank you.
        </p>
      </div>
    </div>
  );
}
