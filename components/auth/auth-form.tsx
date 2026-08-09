"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password.trim()) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
      } else {
        const { error, needsEmailConfirm } = await signUp(email.trim(), password);
        if (error) setError(error);
        else if (needsEmailConfirm) {
          setInfo(`สร้างบัญชีสำเร็จ — กรุณาเช็คอีเมล ${email} เพื่อยืนยันก่อนเข้าใช้งาน`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md mx-auto mb-2">
            <DollarSign className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Software Cost Pro</CardTitle>
          <CardDescription>
            {mode === "signin" ? "เข้าสู่ระบบเพื่อใช้งาน" : "สร้างบัญชีใหม่"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!configured && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 mb-4 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4 w-4" />
                Supabase ยังไม่ได้ตั้งค่า
              </div>
              <p className="text-amber-800 dark:text-amber-300/90">
                แก้ไฟล์ <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env.local</code> ใส่ <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> และ <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> แล้ว restart dev server
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> อีเมล
              </Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={submitting || !configured}
                autoComplete={mode === "signin" ? "email" : "email"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password" className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> รหัสผ่าน
              </Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                disabled={submitting || !configured}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{info}</span>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={submitting || !configured}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground mt-4">
            {mode === "signin" ? (
              <>
                ยังไม่มีบัญชี?{" "}
                <button
                  onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
                  className="text-primary font-semibold hover:underline"
                >
                  สร้างบัญชี
                </button>
              </>
            ) : (
              <>
                มีบัญชีอยู่แล้ว?{" "}
                <button
                  onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
                  className="text-primary font-semibold hover:underline"
                >
                  เข้าสู่ระบบ
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
