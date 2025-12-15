import { Link } from 'react-router-dom';


export function Footer() {
return (
<footer className="border-t mt-12">
<div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
<p>© {new Date().getFullYear()} Magazine Creator. All rights reserved.</p>


<div className="flex items-center gap-4">
<Link to="/terms" className="hover:text-foreground">Terms</Link>
<Link to="/privacy" className="hover:text-foreground">Privacy</Link>
</div>
</div>
</footer>
);
}