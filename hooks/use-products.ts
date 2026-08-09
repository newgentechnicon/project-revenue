import { useCallback } from "react";
import { Product } from "@/lib/types";
import { ProductSchema, safeParseArray } from "@/lib/schemas";
import { usePersistentState } from "@/lib/storage/use-persistent-state";
import { DEFAULT_PRODUCTS } from "@/lib/initial-data";
import { useAuth } from "@/hooks/use-auth";
import { getStorageRepository } from "@/lib/storage/storage-repository";
import { writeVersioned } from "@/lib/migrations";

export const PRODUCTS_STORAGE_KEY = "cost_est_products";

export function useProducts() {
  const { mode } = useAuth();
  const enabled = mode === "supabase";

  const [products, setProducts, hydrated] = usePersistentState<Product[]>({
    key: PRODUCTS_STORAGE_KEY,
    defaultValue: DEFAULT_PRODUCTS,
    hydrate: (raw) => safeParseArray(ProductSchema, raw, "products"),
    enabled,
  });

  const addProduct = useCallback(
    (newItem: Omit<Product, "id">) => {
      const item: Product = { ...newItem, id: "prod_" + Date.now() };
      setProducts((prev) => [...prev, item]);
    },
    [setProducts]
  );

  const updateProduct = useCallback(
    (updated: Product) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [setProducts]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      getStorageRepository().deleteItem(PRODUCTS_STORAGE_KEY, id).catch((e) => {
        console.error(`[use-products] deleteItem failed:`, e);
      });
    },
    [setProducts]
  );

  const replaceAllProducts = useCallback(
    (next: Product[]) => {
      setProducts(next);
      getStorageRepository()
        .replaceAll(PRODUCTS_STORAGE_KEY, writeVersioned(next))
        .catch((e) => console.error(`[use-products] replaceAll failed:`, e));
    },
    [setProducts]
  );

  return {
    products,
    hydrated,
    addProduct,
    updateProduct,
    deleteProduct,
    replaceAllProducts,
  };
}
