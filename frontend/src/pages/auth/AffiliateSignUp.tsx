import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Share2,
  Percent,
  Wallet,
  Zap,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";

const AFFILIATE_CALLBACK = "/dashboard/afiliado?from=afiliado-cadastro";

export default function AffiliateSignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await authApi.register({ email, password, name });
      await authApi.signIn({
        email,
        password,
        callbackUrl: AFFILIATE_CALLBACK,
      });
      return;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Erro ao criar conta. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      sideTitle={
        <>
          Seja um <span className="accent-gradient">Afiliado</span>.
        </>
      }
      sideDescription="Cadastre-se no programa de afiliados, receba seu link exclusivo e ganhe comissão por cada conversão. Sem custo para começar."
      sideElements={
        <div className="space-y-4 mt-5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Share2 size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-foreground font-bold text-sm mb-0.5">
                Link único
              </h4>
              <p className="text-muted text-xs leading-snug">
                Seu link de indicação e dashboard de conversões.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Percent size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-foreground font-bold text-sm mb-0.5">
                Comissão por venda
              </h4>
              <p className="text-muted text-xs leading-snug">
                Ganhe quando seus indicados assinarem um plano pago.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-foreground font-bold text-sm mb-0.5">
                Saque via PIX ou banco
              </h4>
              <p className="text-muted text-xs leading-snug">
                Pagamentos conforme política do programa.
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-surface border border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <Zap size={16} />
            </div>
            <p className="text-xs font-bold text-muted">
              Cadastro gratuito. Aprovação rápida pela equipe.
            </p>
          </div>
        </div>
      }
      formTitle="Cadastro de afiliado"
      formSubtitle="Crie sua conta e em seguida ative seu cadastro como afiliado no painel."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
            Nome completo
          </label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            icon={<UserIcon size={16} />}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
            E-mail
          </label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            icon={<Mail size={16} />}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
              Senha
            </label>
            <Input
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 8 caracteres"
              minLength={8}
              icon={<Lock size={16} />}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
              Confirmar senha
            </label>
            <Input
              required
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              icon={<Lock size={16} />}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted hover:text-foreground transition-colors flex items-center gap-1.5 text-[10px] font-bold"
          >
            {showPassword ? (
              <>
                <EyeOff size={12} /> Ocultar
              </>
            ) : (
              <>
                <Eye size={12} /> Mostrar senhas
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-200 dark:bg-red-500/10 border border-red-600 dark:border-red-500/20 rounded-xl text-red-900 dark:text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          variant="primary"
          className="w-full h-10 text-sm font-black shadow-violet-600/20"
          isLoading={isLoading}
        >
          Criar conta e ser afiliado
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-black text-muted uppercase tracking-wider">
          ou
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() =>
            authApi
              .initiateOAuthSignIn("google", AFFILIATE_CALLBACK)
              .catch(() => {})
          }
          variant="secondary"
          className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
          icon={
            <img
              src="https://authjs.dev/img/providers/google.svg"
              width={20}
              height={20}
              alt=""
              className="shrink-0"
            />
          }
        >
          Google
        </Button>
        <Button
          type="button"
          onClick={() =>
            authApi
              .initiateOAuthSignIn("github", AFFILIATE_CALLBACK)
              .catch(() => {})
          }
          variant="secondary"
          className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
          icon={
            <img
              src="https://authjs.dev/img/providers/github.svg"
              width={20}
              height={20}
              alt=""
              className="shrink-0"
            />
          }
        >
          GitHub
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Já tem conta de afiliado?{" "}
        <Link
          to="/auth/afiliado/entrar"
          className="text-violet-500 hover:text-violet-400 font-bold hover:underline"
        >
          Entrar
        </Link>
      </p>

      <p className="mt-3 text-center text-[10px] text-muted leading-snug">
        Ao se cadastrar, você concorda com nossos{" "}
        <Link
          to="/terms"
          className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          Termos
        </Link>{" "}
        e{" "}
        <Link
          to="/privacy"
          className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          Privacidade
        </Link>
        .
      </p>

      <p className="mt-2 text-center text-[10px] text-muted">
        <Link
          to="/auth/signup"
          className="text-muted hover:text-foreground transition-colors"
        >
          Quero apenas criar conta como cliente
        </Link>
      </p>
    </AuthLayout>
  );
}
