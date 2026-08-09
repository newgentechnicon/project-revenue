import { useCallback } from "react";
import { CompanyInfo } from "@/lib/types";
import { CompanyInfoSchema } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { useAuth } from "@/hooks/use-auth";

export const COMPANY_INFO_STORAGE_KEY = "cost_est_company_info";

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: "ไอโปรเกรสเอ็กซ์ จำกัด",
  taxId: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  signerName: "",
  signerTitle: "Managing Director",
};

export function useCompanyInfo() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [companyInfo, setCompanyInfoState, hydrated] = usePersistentState<CompanyInfo>({
    key: COMPANY_INFO_STORAGE_KEY,
    defaultValue: DEFAULT_COMPANY_INFO,
    schema: CompanyInfoSchema,
    enabled,
  });

  const setCompanyInfo = useCallback(
    (info: CompanyInfo) => setCompanyInfoState(info),
    [setCompanyInfoState]
  );

  return { companyInfo, setCompanyInfo, hydrated };
}
