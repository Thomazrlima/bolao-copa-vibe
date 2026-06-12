"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, LogOut, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [name, setName] = useState("");
  const [telefone, setTelefone] = useState("");
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

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      const updatedUsuario = await updateCurrentUsuario({
        nome_completo: name.trim(),
        telefone: telefone.trim(),
      });

      setUsuario(updatedUsuario);
      setName(updatedUsuario.nome_completo);
      setTelefone(updatedUsuario.telefone);
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
      setPasswordError(
        error instanceof Error ? error.message : "Não foi possível alterar a senha.",
      );
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
    return <SpinningBallLoader label="Carregando configurações" />;
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-destructive/40 bg-destructive/10 p-6">
        <p className="text-sm text-destructive" role="alert">
          {profileError ?? "Não foi possível carregar seu perfil."}
        </p>
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
          <AvatarUpload
            supabase={supabase}
            usuario={usuario}
            displayName={name || usuario.nome_completo}
            onUsuarioChange={(updatedUsuario) => {
              setUsuario(updatedUsuario);
              router.refresh();
            }}
          />

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

          {profileError && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {profileError}
            </p>
          )}

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

            <Button
              type="submit"
              variant="secondary"
              disabled={passwordSaving}
              className="mt-5 w-full"
            >
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
