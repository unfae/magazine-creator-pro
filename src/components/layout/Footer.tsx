import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-12">

        {/* Top section: Logo + columns */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-10">

          {/* Brand column */}
          <div className="sm:col-span-1">
            <Link to="/" className="font-serif text-2xl font-semibold block mb-2">
              Magzine<span className="text-gold">Maker</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Turn your photos into beautiful magazine layouts in minutes.
            </p>
          </div>

          {/* Column 1 - Explore */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Explore</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/templates" className="hover:text-foreground transition-colors">Templates</Link></li>
              <li><Link to="/faqs" className="hover:text-foreground transition-colors">FAQs</Link></li>
              <li><Link to="/template-request" className="hover:text-foreground transition-colors">Request a Template</Link></li>
            </ul>
          </div>

          {/* Column 2 - Company */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
              <li><Link to="/partner" className="hover:text-foreground transition-colors">Partner With Us</Link></li>
            </ul>
          </div>

          {/* Column 3 - Legal */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t pt-6 text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} MagzineMaker. All rights reserved.
        </div>

      </div>
    </footer>
  );
}