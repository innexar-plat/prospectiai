import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError("Nao foi possivel enviar o email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/auth/signin"><Logo iconSize={32} textClassName="text-foreground text-base" /></Link>
        <h1 className="text-xl font-bold text-foreground">Recuperar senha</h1>
        {sent ? <p className="text-muted text-sm">Se esse email estiver cadastrado, voce recebera um link.</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground mb-1">Email</label>
            <Input id="forgot-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} autoComplete="email" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} isLoading={loading}>Enviar link</Button>
          </form>
        )}
        <p className="text-center text-sm"><Link to="/auth/signin" className="text-violet-500 hover:underline">Voltar ao login</Link></p>
      </div>
    </div>
  );
}
