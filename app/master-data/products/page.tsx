"use client";

import React from "react";
import { useAppState } from "@/lib/context/app-state-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ProductsView } from "@/components/project-cost/products-view";

export default function MasterProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useAppState();

  return (
    <AppLayout>
      <ProductsView
        products={products}
        onAddProduct={addProduct}
        onUpdateProduct={updateProduct}
        onDeleteProduct={deleteProduct}
      />
    </AppLayout>
  );
}
