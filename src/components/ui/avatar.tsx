"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

export function formatAvatarUrl(url: string | null | undefined): string {
  if (!url) return '';
  const clean = url.trim().replace(/^["']|["']$/g, '');
  if (!clean) return '';
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:') ||
    clean.startsWith('blob:') ||
    clean.startsWith('/')
  ) {
    return clean;
  }
  const supabaseBase = 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public';
  if (clean.startsWith('avatars/') || clean.startsWith('profiles/') || clean.startsWith('albums/') || clean.startsWith('covers/')) {
    return `${supabaseBase}/${clean}`;
  }
  return `${supabaseBase}/avatars/${clean}`;
}

export function UserAvatar({
  name,
  src,
  image,
  size = 'md',
  className,
}: {
  name?: string | null;
  src?: string | null;
  image?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string;
  className?: string;
}) {
  const finalSrc = formatAvatarUrl(src || image);
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [finalSrc]);

  const sizeClasses =
    size === 'xs'
      ? 'h-6 w-6 text-[10px]'
      : size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-14 w-14 text-lg'
      : size === 'xl'
      ? 'h-20 w-20 text-2xl'
      : size === '2xl'
      ? 'h-24 w-24 text-3xl'
      : size === 'md'
      ? 'h-10 w-10 text-sm'
      : '';

  const initials = (name || 'User')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const showImage = Boolean(finalSrc && !imgError);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted select-none",
        sizeClasses,
        className
      )}
    >
      {showImage ? (
        <img
          src={finalSrc}
          alt={name || 'User Avatar'}
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold text-accent bg-accent/15 tracking-tight">
          {initials}
        </span>
      )}
    </div>
  );
}

export function FallbackAvatar({
  name,
  className,
  size = 'md',
}: {
  name?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string;
}) {
  const sizeClasses =
    size === 'xs'
      ? 'h-6 w-6 text-[10px]'
      : size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-14 w-14 text-lg'
      : size === 'xl'
      ? 'h-20 w-20 text-2xl'
      : size === '2xl'
      ? 'h-24 w-24 text-3xl'
      : size === 'md'
      ? 'h-10 w-10 text-sm'
      : '';

  const initials = (name || 'User')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-accent/15 text-accent font-bold tracking-tight select-none",
        sizeClasses,
        className
      )}
    >
      {initials}
    </div>
  );
}
