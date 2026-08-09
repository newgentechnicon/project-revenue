import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseStorageRepository } from "./supabase-storage-repository";

function createClient(activeOrgId: string | null) {
  const rpc = vi.fn().mockResolvedValue({ data: activeOrgId, error: null });
  const from = vi.fn();
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    rpc,
    from,
  } as unknown as SupabaseClient;

  return { client, rpc, from };
}

describe("SupabaseStorageRepository organization guard", () => {
  it("uses the active-organization RPC", async () => {
    const { client, rpc } = createClient(null);
    const repository = new SupabaseStorageRepository(client);

    await repository.read("cost_est_projects");

    expect(rpc).toHaveBeenCalledWith("get_active_organization");
  });

  it("does not query tenant tables before an organization is selected", async () => {
    const { client, from } = createClient(null);
    const repository = new SupabaseStorageRepository(client);

    await repository.read("cost_est_projects");
    await repository.write(
      "cost_est_projects",
      JSON.stringify({ version: 1, data: [{ id: "project-1" }] })
    );

    expect(from).not.toHaveBeenCalled();
  });
});

