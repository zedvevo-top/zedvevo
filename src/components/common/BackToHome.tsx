import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import BackButton from '@/components/common/BackButton';

/**
 * Universal top navigation strip shown at the top of pages.
 * Features a Back button (useNavigate(-1)) and a Home breadcrumb.
 */
export default function BackToHome({ showHome = true }: { showHome?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4 select-none">
      <BackButton showLabel label="Back" variant="ghost" size="sm" className="h-7 px-2 text-xs bg-muted/40 hover:bg-accent/15 hover:text-accent border border-border/40 rounded-lg" />
      {showHome && (
        <>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-1.5 rounded hover:bg-muted/30"
          >
            <Home className="h-3 w-3 shrink-0" />
            Home
          </Link>
        </>
      )}
    </div>
  );
}
