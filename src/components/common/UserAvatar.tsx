"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarPublicUrlFromPath } from "@/lib/avatar-storage";
import { getInitials } from "@/lib/display-name";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  avatarPath?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export function UserAvatar({
  name,
  avatarPath,
  className,
  imageClassName,
  fallbackClassName,
}: UserAvatarProps) {
  const avatarUrl = getAvatarPublicUrlFromPath(avatarPath);

  return (
    <Avatar className={className}>
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={`Foto de perfil de ${name}`}
          className={cn("object-cover", imageClassName)}
        />
      )}
      <AvatarFallback className={fallbackClassName}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
