import type { SupabaseClient } from "@supabase/supabase-js";

import { updateCurrentUsuario, type AvatarPath, type Usuario } from "@/lib/queries";

export const AVATAR_BUCKET = "profiles";
export const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const USER_PROFILE_UPDATED_EVENT = "usuario-profile-updated";

const AVATAR_FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AvatarMimeType = keyof typeof AVATAR_FILE_TYPES;
type AvatarExtension = (typeof AVATAR_FILE_TYPES)[AvatarMimeType];

export type AvatarUploadResult = {
  usuario: Usuario;
  avatarPath: AvatarPath;
  publicUrl: string;
  previousAvatarRemovalFailed: boolean;
};

export class AvatarError extends Error {
  code:
    | "not_authenticated"
    | "invalid_type"
    | "file_too_large"
    | "storage_upload_failed"
    | "profile_update_failed"
    | "storage_remove_failed";

  constructor(code: AvatarError["code"], message: string) {
    super(message);
    this.name = "AvatarError";
    this.code = code;
  }
}

export function validateAvatarFile(file: File): AvatarExtension {
  if (!(file.type in AVATAR_FILE_TYPES)) {
    throw new AvatarError("invalid_type", "Selecione uma imagem JPEG, PNG ou WebP.");
  }

  if (file.size > AVATAR_MAX_FILE_SIZE) {
    throw new AvatarError("file_too_large", "A imagem deve ter no máximo 5 MB.");
  }

  return AVATAR_FILE_TYPES[file.type as AvatarMimeType];
}

export function getAvatarPublicUrl(
  _supabase: SupabaseClient,
  avatarPath: string | null | undefined,
) {
  return getAvatarPublicUrlFromPath(avatarPath);
}

export function getAvatarPublicUrlFromPath(avatarPath: string | null | undefined) {
  if (!avatarPath) return null;

  // Mantém compatibilidade visual com valores antigos, sem permitir novos uploads nesse formato.
  if (/^(?:https?:|data:|blob:)/i.test(avatarPath)) return avatarPath;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) return null;

  const encodedPath = avatarPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${encodedPath}`;
}

export async function uploadCurrentUserAvatar(
  supabase: SupabaseClient,
  file: File,
  previousAvatarPath: string | null,
): Promise<AvatarUploadResult> {
  const extension = validateAvatarFile(file);
  const user = await getAuthenticatedUser(supabase);
  const avatarPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Falha no upload do avatar:", uploadError);
    throw new AvatarError(
      "storage_upload_failed",
      "Não foi possível enviar a imagem. Tente novamente.",
    );
  }

  let usuario: Usuario;

  try {
    usuario = await updateCurrentUsuario({ avatar_url: avatarPath });
  } catch (error) {
    const { error: rollbackError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([avatarPath]);

    if (rollbackError) {
      console.error("Falha ao remover avatar após erro no perfil:", rollbackError);
    }

    console.error("Falha ao salvar o caminho do avatar:", error);
    throw new AvatarError(
      "profile_update_failed",
      "A imagem foi enviada, mas não foi possível atualizar o perfil. Tente novamente.",
    );
  }

  let previousAvatarRemovalFailed = false;

  if (isOwnedStoragePath(previousAvatarPath, user.id) && previousAvatarPath !== avatarPath) {
    const { error: removeError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([previousAvatarPath]);

    if (removeError) {
      previousAvatarRemovalFailed = true;
      console.error("Falha ao remover o avatar anterior:", removeError);
    }
  }

  notifyProfileUpdated();

  return {
    usuario,
    avatarPath,
    publicUrl: getAvatarPublicUrl(supabase, avatarPath) ?? "",
    previousAvatarRemovalFailed,
  };
}

export async function removeCurrentUserAvatar(supabase: SupabaseClient, avatarPath: string | null) {
  const user = await getAuthenticatedUser(supabase);

  if (!avatarPath) {
    return updateCurrentUsuario({ avatar_url: null });
  }

  let usuario: Usuario;

  try {
    usuario = await updateCurrentUsuario({ avatar_url: null });
  } catch (error) {
    console.error("Falha ao limpar o avatar do perfil:", error);
    throw new AvatarError(
      "profile_update_failed",
      "Não foi possível remover a foto do perfil. Tente novamente.",
    );
  }

  if (isOwnedStoragePath(avatarPath, user.id)) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);

    if (removeError) {
      console.error("Falha ao remover avatar do Storage:", removeError);

      try {
        usuario = await updateCurrentUsuario({ avatar_url: avatarPath });
      } catch (restoreError) {
        console.error("Falha ao restaurar o caminho do avatar:", restoreError);
      }

      throw new AvatarError(
        "storage_remove_failed",
        "Não foi possível remover a imagem. Tente novamente.",
      );
    }
  }

  notifyProfileUpdated();
  return usuario;
}

async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new AvatarError("not_authenticated", "Entre novamente para alterar sua foto.");
  }

  return data.user;
}

function isOwnedStoragePath(path: string | null, userId: string): path is string {
  return Boolean(path?.startsWith(`${userId}/`));
}

function notifyProfileUpdated() {
  window.dispatchEvent(new Event(USER_PROFILE_UPDATED_EVENT));
}
