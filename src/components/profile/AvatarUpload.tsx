"use client";

import { ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/display-name";
import {
  AVATAR_ACCEPT,
  getAvatarPublicUrl,
  removeCurrentUserAvatar,
  uploadCurrentUserAvatar,
  validateAvatarFile,
} from "@/lib/avatar-storage";
import type { Usuario } from "@/lib/queries";

type AvatarUploadProps = {
  supabase: SupabaseClient;
  usuario: Usuario;
  displayName: string;
  onUsuarioChange: (usuario: Usuario) => void;
};

export function AvatarUpload({
  supabase,
  usuario,
  displayName,
  onUsuarioChange,
}: AvatarUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentUrl = getAvatarPublicUrl(supabase, usuario.avatar_url);
  const displayedUrl = previewUrl ?? currentUrl;
  const busy = uploading || removing;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setMessage(null);

    if (!file) return;

    try {
      validateAvatarFile(file);
    } catch (validationError) {
      event.target.value = "";
      setSelectedFile(null);
      setPreviewUrl(null);
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Não foi possível validar a imagem.",
      );
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelection() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!selectedFile || busy) return;

    const requestId = ++requestIdRef.current;
    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await uploadCurrentUserAvatar(supabase, selectedFile, usuario.avatar_url);

      if (requestId !== requestIdRef.current) return;

      onUsuarioChange(result.usuario);
      clearSelection();
      setMessage(
        result.previousAvatarRemovalFailed
          ? "Foto atualizada. A imagem anterior não pôde ser excluída."
          : "Foto de perfil atualizada.",
      );
    } catch (uploadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.",
      );
    } finally {
      if (requestId === requestIdRef.current) setUploading(false);
    }
  }

  async function handleRemove() {
    if (busy) return;

    const requestId = ++requestIdRef.current;
    setRemoving(true);
    setError(null);
    setMessage(null);

    try {
      const updatedUsuario = await removeCurrentUserAvatar(supabase, usuario.avatar_url);

      if (requestId !== requestIdRef.current) return;

      onUsuarioChange(updatedUsuario);
      clearSelection();
      setMessage("Foto de perfil removida.");
    } catch (removeError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        removeError instanceof Error ? removeError.message : "Não foi possível remover a imagem.",
      );
    } finally {
      if (requestId === requestIdRef.current) setRemoving(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col items-center gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar className="h-28 w-28 border-2 border-primary/50 bg-primary/10 shadow-lg">
          {displayedUrl && (
            <AvatarImage
              src={displayedUrl}
              alt={`Foto de perfil de ${displayName}`}
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-primary/15 font-display text-3xl font-black text-primary">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          aria-label={currentUrl ? "Selecionar outra foto" : "Selecionar foto"}
        >
          <Camera className="h-4 w-4" />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Selecione uma foto de perfil JPEG, PNG ou WebP
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={AVATAR_ACCEPT}
          onChange={handleFileChange}
          disabled={busy}
          className="sr-only"
        />
      </div>

      <div className="text-center sm:text-left">
        <h3 className="font-display text-xl font-black">{displayName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG ou WebP de até 5 MB.</p>

        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Camera className="h-4 w-4" />
            {currentUrl ? "Trocar foto" : "Selecionar foto"}
          </Button>

          {selectedFile && (
            <>
              <Button type="button" size="sm" onClick={handleUpload} disabled={busy}>
                {uploading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Enviando..." : "Enviar foto"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={busy}
              >
                Cancelar
              </Button>
            </>
          )}

          {currentUrl && !selectedFile && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                  Remover foto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover foto de perfil?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sua imagem atual será excluída e o avatar voltará a mostrar suas iniciais.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemove}
                    disabled={removing}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {removing ? "Removendo..." : "Remover"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="mt-3 min-h-5" aria-live="polite" aria-atomic="true">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-success sm:justify-start">
              <Check className="h-4 w-4" />
              {message}
            </p>
          )}
          {busy && <span className="sr-only">Processando foto de perfil.</span>}
        </div>
      </div>
    </div>
  );
}
