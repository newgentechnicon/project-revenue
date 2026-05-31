"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Organization, Membership, OrgRole, DataScope } from "@/lib/types";
import {
  FeatureKey, FeatureAccess, FeatureAccessMatrix, resolveAccess,
} from "@/lib/features";

interface OrgState {
  loading: boolean;
  org: Organization | null;
  role: OrgRole | null;
  dataScope: DataScope | null;
  isAdmin: boolean;
  /** สิทธิ์แก้ไขข้อมูลทั่วไป (ทุก role ยกเว้น viewer) — ใช้เมื่อไม่ระบุ feature */
  canEdit: boolean;
  members: Membership[];
  // Feature-level permissions
  featureMatrix: FeatureAccessMatrix;
  featureAccess: (feature: FeatureKey) => FeatureAccess;
  canView: (feature: FeatureKey) => boolean;
  canEditFeature: (feature: FeatureKey) => boolean;
  updateFeatureAccess: (role: OrgRole, feature: FeatureKey, level: FeatureAccess) => Promise<string | null>;
  refresh: () => Promise<void>;
  updateMember: (userId: string, patch: { role?: OrgRole; dataScope?: DataScope; active?: boolean }) => Promise<string | null>;
  removeMember: (userId: string) => Promise<string | null>;
  renameOrg: (name: string) => Promise<string | null>;
}

const OrgContext = createContext<OrgState | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [dataScope, setDataScope] = useState<DataScope | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [featureMatrix, setFeatureMatrix] = useState<FeatureAccessMatrix>({});

  const isAdmin = role === "owner" || role === "admin";
  const canEdit = role != null && role !== "viewer";

  const featureAccess = useCallback(
    (feature: FeatureKey): FeatureAccess => resolveAccess(featureMatrix, role, feature),
    [featureMatrix, role]
  );
  const canView = useCallback((feature: FeatureKey) => featureAccess(feature) !== "none", [featureAccess]);
  const canEditFeature = useCallback((feature: FeatureKey) => featureAccess(feature) === "edit", [featureAccess]);

  const load = useCallback(async () => {
    if (mode !== "supabase" || !user || !isSupabaseConfigured()) {
      setOrg(null);
      setRole(null);
      setDataScope(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    setLoading(true);
    try {
      // membership ของผู้ใช้ปัจจุบัน
      const { data: myMembership } = await supabase
        .from("memberships")
        .select("org_id, role, data_scope, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (myMembership) {
        setRole(myMembership.role as OrgRole);
        setDataScope(myMembership.data_scope as DataScope);

        const { data: orgRow } = await supabase
          .from("organizations")
          .select("id, name, feature_access")
          .eq("id", myMembership.org_id)
          .maybeSingle();
        if (orgRow) {
          setOrg({ id: orgRow.id, name: orgRow.name });
          setFeatureMatrix((orgRow.feature_access as FeatureAccessMatrix) ?? {});
        }

        // รายชื่อสมาชิก (ผ่าน RPC ที่ join อีเมล)
        const { data: memberRows, error: memErr } = await supabase.rpc("list_org_members");
        if (memErr) {
          console.error("[use-org] list_org_members failed:", memErr);
        } else if (Array.isArray(memberRows)) {
          setMembers(
            memberRows.map((m) => ({
              orgId: myMembership.org_id as string,
              userId: m.user_id as string,
              email: m.email as string,
              role: m.role as OrgRole,
              dataScope: m.data_scope as DataScope,
              active: m.active as boolean,
            }))
          );
        }
      }
    } catch (e) {
      console.error("[use-org] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [mode, user]);

  useEffect(() => {
    // sync membership/org จาก Supabase เข้า React state เมื่อ auth พร้อม (external → React)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const updateMember = useCallback(
    async (
      userId: string,
      patch: { role?: OrgRole; dataScope?: DataScope; active?: boolean }
    ): Promise<string | null> => {
      const supabase = getSupabaseBrowserClient();
      const row: Record<string, unknown> = {};
      if (patch.role !== undefined) row.role = patch.role;
      if (patch.dataScope !== undefined) row.data_scope = patch.dataScope;
      if (patch.active !== undefined) row.active = patch.active;
      const { error } = await supabase.from("memberships").update(row).eq("user_id", userId);
      if (error) return error.message;
      await load();
      return null;
    },
    [load]
  );

  const removeMember = useCallback(
    async (userId: string): Promise<string | null> => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("memberships").delete().eq("user_id", userId);
      if (error) return error.message;
      await load();
      return null;
    },
    [load]
  );

  const updateFeatureAccess = useCallback(
    async (r: OrgRole, feature: FeatureKey, level: FeatureAccess): Promise<string | null> => {
      if (!org) return "ยังไม่มีข้อมูล org";
      const next: FeatureAccessMatrix = {
        ...featureMatrix,
        [r]: { ...(featureMatrix[r] ?? {}), [feature]: level },
      };
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("organizations")
        .update({ feature_access: next })
        .eq("id", org.id);
      if (error) return error.message;
      setFeatureMatrix(next);
      return null;
    },
    [org, featureMatrix]
  );

  const renameOrg = useCallback(
    async (name: string): Promise<string | null> => {
      if (!org) return "ยังไม่มีข้อมูล org";
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("organizations").update({ name }).eq("id", org.id);
      if (error) return error.message;
      setOrg({ ...org, name });
      return null;
    },
    [org]
  );

  return (
    <OrgContext.Provider
      value={{
        loading,
        org,
        role,
        dataScope,
        isAdmin,
        canEdit,
        members,
        featureMatrix,
        featureAccess,
        canView,
        canEditFeature,
        updateFeatureAccess,
        refresh: load,
        updateMember,
        removeMember,
        renameOrg,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgState {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return ctx;
}
