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

export function UserAvatar({
  name,
  src,
  image,
  size,
  className,
}: {
  name?: string | null;
  src?: string | null;
  image?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  className?: string;
}) {
  const finalSrc = src || image;
  const sizeClasses =
    size === 'sm'
      ? 'h-8 w-8'
      : size === 'lg'
      ? 'h-14 w-14'
      : size === 'xl'
      ? 'h-20 w-20'
      : size === 'md'
      ? 'h-10 w-10'
      : '';

  return (
    <Avatar className={cn(sizeClasses, className)}>
      {finalSrc && <AvatarImage src={finalSrc} alt={name || 'Avatar'} />}
      <AvatarFallback>{(name || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
