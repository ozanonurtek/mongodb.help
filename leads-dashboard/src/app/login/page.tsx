"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      setError(r.status === 401 ? "Wrong password" : "Sign-in failed");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-bold">leads.mongodb.help</h1>
      <p className="text-sm text-muted-foreground">
        Admin dashboard. Sign in with the admin password.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <Button type="submit" disabled={loading || !password}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </main>
  );
}
