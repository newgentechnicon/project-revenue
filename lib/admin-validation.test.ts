import { describe, expect, it } from "vitest";
import {
  createOrganizationSchema,
  createOrganizationUserSchema,
  updateOrganizationSchema,
} from "./admin-validation";

describe("admin provisioning validation", () => {
  it("trims organization names", () => {
    expect(createOrganizationSchema.parse({ name: "  Acme Co  " }).name).toBe("Acme Co");
  });

  it("validates and trims organization updates", () => {
    const result = updateOrganizationSchema.parse({
      id: "4e9a1e41-9350-48eb-96e5-c15c86c8e12c",
      name: "  Acme Thailand  ",
    });
    expect(result).toEqual({
      id: "4e9a1e41-9350-48eb-96e5-c15c86c8e12c",
      name: "Acme Thailand",
    });
  });

  it("normalizes an account email", () => {
    const result = createOrganizationUserSchema.parse({
      accountMode: "new",
      orgId: "4e9a1e41-9350-48eb-96e5-c15c86c8e12c",
      email: "OWNER@EXAMPLE.COM",
      password: "temporary-password",
      role: "owner",
      dataScope: "all",
    });
    if (result.accountMode !== "new") throw new Error("Expected new account");
    expect(result.email).toBe("owner@example.com");
  });

  it("rejects weak passwords", () => {
    const result = createOrganizationUserSchema.safeParse({
      accountMode: "new",
      orgId: "4e9a1e41-9350-48eb-96e5-c15c86c8e12c",
      email: "owner@example.com",
      password: "short",
      role: "owner",
      dataScope: "all",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an existing account by user id without a password", () => {
    const result = createOrganizationUserSchema.parse({
      accountMode: "existing",
      orgId: "4e9a1e41-9350-48eb-96e5-c15c86c8e12c",
      userId: "9f0492ef-f16b-464e-9e7e-97b946fc5155",
      role: "viewer",
      dataScope: "own",
    });
    expect(result.accountMode).toBe("existing");
  });
});
