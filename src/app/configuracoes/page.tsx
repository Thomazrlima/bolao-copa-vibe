"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Eye, EyeOff, LogOut, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInitials } from "@/lib/display-name";
import {
  getCurrentUsuario,
  updateCurrentUserPassword,
  updateCurrentUsuario,
  type Usuario,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [name, setName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const loadedUsuario = await getCurrentUsuario();

        if (!active) return;

        if (!loadedUsuario) {
          router.push("/login");
          return;
        }

        setUsuario(loadedUsuario);
        setName(loadedUsuario.nome_completo);
        setTelefone(loadedUsuario.telefone);
        setPhoto(loadedUsuario.avatar_url);
      } catch (error) {
        if (!active) return;
        setProfileError(
          error instanceof Error ? error.message : "Não foi possível carregar seu perfil.",
        );
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextPhoto = typeof reader.result === "string" ? reader.result : null;
      setPhoto(nextPhoto);
      setProfileSaved(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      const updatedUsuario = await updateCurrentUsuario({
        nome_completo: name.trim(),
        telefone: telefone.trim(),
        avatar_url: photo,
      });

      setUsuario(updatedUsuario);
      setName(updatedUsuario.nome_completo);
      setTelefone(updatedUsuario.telefone);
      setPhoto(updatedUsuario.avatar_url);
      setProfileSaved(true);
      router.refresh();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setPasswordSaving(true);

    if (newPassword.length < 8) {
      setPasswordError("A nova senha deve ter pelo menos 8 caracteres.");
      setPasswordSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da senha não confere.");
      setPasswordSaving(false);
      return;
    }

    try {
      await updateCurrentUserPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!usuario && !profileError) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Minha conta</p>
        <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Configurações do perfil
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize seus dados e as configurações de acesso.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-xl border border-border bg-card p-4 sm:p-6"
        >
          <div className="mb-6 flex flex-col items-center gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
            <div className="relative">
              <Avatar className="h-28 w-28 border-2 border-primary/50 bg-primary/10 shadow-lg">
                {photo && <AvatarImage src={photo} alt={name} className="object-cover" />}
                <AvatarFallback className="bg-primary/15 font-display text-3xl font-black text-primary">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow transition-transform hover:scale-105"
                aria-label="Enviar nova foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="sr-only"
              />
            </div>

            <div className="text-center sm:text-left">
              <h3 className="font-display text-xl font-black">{name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">JPG, PNG ou WebP de até 3 MB.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={profileSaving}
                className="mt-3"
              >
                <Camera className="h-4 w-4" />
                Trocar foto
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setProfileSaved(false);
              }}
              autoComplete="name"
              required
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(event) => {
                setTelefone(event.target.value);
                setProfileSaved(false);
              }}
              autoComplete="tel"
            />
          </div>

          {profileError && <p className="mt-4 text-sm text-destructive">{profileError}</p>}

          {profileSaved && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
              <Check className="h-4 w-4" />
              Perfil atualizado.
            </p>
          )}

          <Button type="submit" disabled={profileSaving} className="mt-5 w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {profileSaving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </form>

        <div className="space-y-5">
          <form
            onSubmit={handlePasswordSubmit}
            className="rounded-xl border border-border bg-card p-4 sm:p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-black">Alterar senha</h3>
                <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha atual</Label>
                <Input
                  id="current-password"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((visible) => !visible)}
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
            </button>

            {passwordError && <p className="mt-4 text-sm text-destructive">{passwordError}</p>}
            {passwordSaved && (
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
                <Check className="h-4 w-4" />
                Senha alterada.
              </p>
            )}

            <Button type="submit" variant="secondary" disabled={passwordSaving} className="mt-5 w-full">
              {passwordSaving ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>

          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
            <h3 className="font-display font-black">Sair da conta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Você será direcionado para a página de login.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-4 w-full border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
