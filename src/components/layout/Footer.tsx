import { Link } from "react-router-dom";
import { FaInstagram, FaTiktok, FaLinkedinIn, FaFacebook } from "react-icons/fa6";

const socialIconClass = "w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold transition-colors duration-200";

export function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-12">

        <div className="flex flex-col sm:flex-row gap-10">

          {/* Brand column */}
          <div className="sm:w-64 shrink-0">
            <Link to="/" className="font-serif text-2xl font-semibold block mb-2">
              Magzine<span className="text-gold">Maker</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Turn your photos into beautiful magazine layouts in minutes.
            </p>

            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/magznmaker?igsh=ajR0dm1jejNldmc2" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={socialIconClass}>
                <FaInstagram className="h-4 w-4" />
              </a>
              <a href="https://www.tiktok.com/@magznmaker?_r=1&_t=ZS-94QSyaXJJv3" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={socialIconClass}>
                <FaTiktok className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/company/magznmaker/about/?viewAsMember=true" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={socialIconClass}>
                <FaLinkedinIn className="h-4 w-4" />
              </a>
              {/* FACEBOOK: replace # with your URL and uncomment to activate
              <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={socialIconClass}>
                <FaFacebook className="h-4 w-4" />
              </a>
              */}
            </div>
          </div>

          {/* Link columns */}
          <div className="flex-1 flex justify-end">
            <div className="grid grid-cols-3 gap-12">

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Explore</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link to="/templates" className="hover:text-foreground transition-colors">Templates</Link></li>
                  <li><Link to="/faqs" className="hover:text-foreground transition-colors">FAQs</Link></li>
                  <li><Link to="/template-request" className="hover:text-foreground transition-colors">Request a Template</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4">Company</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
                  <li><Link to="/partner" className="hover:text-foreground transition-colors">Partner With Us</Link></li>
                </ul>
              </div>


            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} MagzineMaker. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}