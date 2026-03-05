import { Link } from "react-router-dom";
import { Instagram, Linkedin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// TikTok icon
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z" />
  </svg>
);

// const FacebookIcon = () => (
//   <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
//     <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
//   </svg>
// );

type SocialLink = {
  label: string;
  href: string;
  Icon: LucideIcon | (() => JSX.Element);
};

const socials: SocialLink[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/magznmaker?igsh=ajR0dm1jejNldmc2",
    Icon: Instagram,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@magznmaker?_r=1&_t=ZS-94QSyaXJJv3",
    Icon: TikTokIcon,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/magznmaker/about/?viewAsMember=true",
    Icon: Linkedin,
  },
  // Uncomment and update href to activate Facebook:
  // {
  //   label: "Facebook",
  //   href: "https://www.facebook.com/YOUR_PAGE_HERE",
  //   Icon: FacebookIcon,
  // },
];

export function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-12">

        {/* Top section */}
        <div className="flex flex-col sm:flex-row gap-10">

          {/* Brand column */}
          <div className="sm:w-64 shrink-0">
            <Link to="/" className="font-serif text-2xl font-semibold block mb-2">
              Magzine<span className="text-gold">Maker</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Turn your photos into beautiful magazine layouts in minutes.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3">
              {socials.map(({ label, href, Icon }) => (
                
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold transition-colors duration-200"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns — grouped far right */}
          <div className="flex-1 flex justify-end">
            <div className="grid grid-cols-3 gap-12">

              {/* Explore */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Explore</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link to="/templates" className="hover:text-foreground transition-colors">Templates</Link></li>
                  <li><Link to="/faqs" className="hover:text-foreground transition-colors">FAQs</Link></li>
                  <li><Link to="/template-request" className="hover:text-foreground transition-colors">Request a Template</Link></li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Company</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
                  <li><Link to="/partner" className="hover:text-foreground transition-colors">Partner With Us</Link></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Legal</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
                  <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>

            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t mt-10 pt-6 text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} MagzineMaker. All rights reserved.
        </div>

      </div>
    </footer>
  );
}