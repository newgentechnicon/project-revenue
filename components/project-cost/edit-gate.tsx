"use client";

import React, { createContext, useContext } from "react";
import { useOrg } from "@/hooks/use-org";
import type { FeatureKey } from "@/lib/features";
import { Lock } from "lucide-react";

/**
 * Feature ปัจจุบันของหน้า (ตั้งโดย AppLayout ตาม route)
 * ทำให้ EditGate รู้ว่าอยู่ในฟีเจอร์ไหนโดยไม่ต้องส่ง prop ทุกจุด
 */
const FeatureScopeContext = createContext<FeatureKey | null>(null);

export function FeatureScopeProvider({
  feature,
  children,
}: {
  feature: FeatureKey | null;
  children: React.ReactNode;
}) {
  return <FeatureScopeContext.Provider value={feature}>{children}</FeatureScopeContext.Provider>;
}

/**
 * แสดง children เฉพาะเมื่อผู้ใช้มีสิทธิ์แก้ไข
 *  - admin: เฉพาะ owner/admin
 *  - feature (หรือ feature ปัจจุบันจาก route): ต้องมีสิทธิ์ระดับ edit ของฟีเจอร์นั้น
 *  - ไม่มี feature เลย: fallback เป็น canEdit (role ≠ viewer)
 *
 * หมายเหตุ: นี่เป็น UX layer เท่านั้น — ด่านจริงคือ RLS ฝั่ง Supabase
 */
export function EditGate({
  children,
  admin = false,
  feature,
  fallback = null,
}: {
  children: React.ReactNode;
  admin?: boolean;
  feature?: FeatureKey;
  fallback?: React.ReactNode;
}) {
  const { canEdit, isAdmin, canEditFeature } = useOrg();
  const ctxFeature = useContext(FeatureScopeContext);
  const effectiveFeature = feature ?? ctxFeature;

  let allowed: boolean;
  if (admin) allowed = isAdmin;
  else if (effectiveFeature) allowed = canEditFeature(effectiveFeature);
  else allowed = canEdit;

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

/** แบนเนอร์แจ้งโหมดอ่านอย่างเดียว — แสดงเมื่อฟีเจอร์ปัจจุบันมีสิทธิ์แค่ระดับ view */
export function ReadOnlyBanner() {
  const { loading, role, canEditFeature, canEdit } = useOrg();
  const feature = useContext(FeatureScopeContext);
  if (loading || !role) return null;

  // อ่านอย่างเดียวถ้า: มี feature แต่แก้ไม่ได้ / ไม่มี feature แต่ role แก้อะไรไม่ได้เลย
  const readOnly = feature ? !canEditFeature(feature) : !canEdit;
  if (!readOnly) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/70 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900 print:hidden">
      <Lock className="h-4 w-4 shrink-0" />
      <span>
        โหมด<span className="font-semibold">อ่านอย่างเดียว</span> — บัญชีของคุณไม่มีสิทธิ์แก้ไขในเมนูนี้
        ติดต่อผู้ดูแลเพื่อขอสิทธิ์เพิ่ม
      </span>
    </div>
  );
}
