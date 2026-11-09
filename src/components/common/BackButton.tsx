import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BackButtonProps {
  label?: string;
  showLabel?: boolean;
  className?: string;
  fallbackPath?: string;
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  iconType?: 'chevron' | 'arrow';
}

/**
 * Universal 'Back' button component using useNavigate(-1).
 * Safe against empty history by falling back to fallbackPath (default '/').
 */
export default function BackButton({
  label = 'Back',
  showLabel = false,
  className,
  fallbackPath = '/',
  variant = 'ghost',
  size = 'sm',
  iconType = 'chevron',
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // If already at the root page and no history, do nothing or hide
  const isRoot = location.pathname === '/';

  const handleBack = () => {
    // Check if there is browser history to step back into
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  const Icon = iconType === 'arrow' ? ArrowLeft : ChevronLeft;

  if (isRoot && !fallbackPath) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleBack}
      className={cn(
        'group transition-all select-none gap-1 text-muted-foreground hover:text-foreground active:scale-95 shrink-0',
        size === 'sm' && !showLabel && 'h-8 w-8 p-0 rounded-full hover:bg-accent/15 hover:text-accent',
        showLabel && 'px-2.5 h-8 text-xs font-medium hover:bg-accent/10 hover:text-accent',
        className
      )}
      title="Go back"
      aria-label="Go back"
    >
      <Icon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {showLabel && <span>{label}</span>}
    </Button>
  );
}
