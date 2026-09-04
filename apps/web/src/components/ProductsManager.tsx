'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

interface Ref { id: string; name: string }
interface Product {
  id: string; sku: string; name: string; unitPrice: string | number; stockQuantity: number; reorderLevel: number;
  categoryRef: Ref | null; brand: Ref | null; unit: Ref | null;
}

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Ref[]>([]);
  const [brands, setBrands] = useState<Ref[]>([]);
  const [units, setUnits] = useState<Ref[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const [canCreate, canUpdate, canDelete] = usePermissions("PRODUCTS:CREATE", "PRODUCTS:UPDATE", "PRODUCTS:DELETE");

  function load() {
    api.get<Product[]>(`/products${lowStockOnly ? "?lowStock=true" : ""}`).then(setProducts).catch(e => setError(e.message));
    api.get<Ref[]>("/categories").then(setCategories).catch(() => {});
    api.get<Ref[]>("/brands").then(setBrands).catch(() => {});
    api.get<Ref[]>("/units").then(setUnits).catch(() => {});
  }
  useEffect(load, [lowStockOnly]);

  async function remove(product: Product) {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    try { await api.delete(`/products/${product.id}`); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  return (
    <AppShell title="Products">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{products ? `${products.length} product${products.length === 1 ? "" : "s"}` : "Loading..."}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label className="checkbox-row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} />
            Low stock only
          </label>
          {canCreate && <button onClick={() => setEditing("new")}>+ New Product</button>}
        </div>
      </div>
      <div className="table-wrap">
        {products && products.length === 0 && <div className="empty">No products{lowStockOnly ? " below reorder level" : ""}.</div>}
        {products && products.length > 0 && (
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Brand</th><th>Unit</th><th>Price</th><th>Stock</th><th>Reorder At</th><th></th></tr></thead>
            <tbody>
              {products.map(p => {
                const low = p.stockQuantity <= p.reorderLevel;
                return (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.categoryRef?.name || "—"}</td>
                    <td>{p.brand?.name || "—"}</td>
                    <td>{p.unit?.name || "—"}</td>
                    <td>{money.format(Number(p.unitPrice))}</td>
                    <td><span className={`badge ${low ? "inactive" : "active"}`}>{p.stockQuantity}</span></td>
                    <td>{p.reorderLevel}</td>
                    <td className="row-actions">
                      {canUpdate && <button className="secondary" onClick={() => setEditing(p)}>Edit</button>}
                      {canDelete && <button className="secondary" onClick={() => remove(p)}>Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          categories={categories} brands={brands} units={units}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </AppShell>
  );
}

function ProductModal({ product, categories, brands, units, onClose, onSaved }: {
  product: Product | null; categories: Ref[]; brands: Ref[]; units: Ref[]; onClose: () => void; onSaved: () => void;
}) {
  const [sku, setSku] = useState(product?.sku || "");
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.categoryRef?.id || "");
  const [brandId, setBrandId] = useState(product?.brand?.id || "");
  const [unitId, setUnitId] = useState(product?.unit?.id || "");
  const [unitPrice, setUnitPrice] = useState(product ? String(product.unitPrice) : "");
  const [stockQuantity, setStockQuantity] = useState(product ? String(product.stockQuantity) : "0");
  const [reorderLevel, setReorderLevel] = useState(product ? String(product.reorderLevel) : "10");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const payload = {
      sku, name,
      categoryId: categoryId || undefined, brandId: brandId || undefined, unitId: unitId || undefined,
      unitPrice: Number(unitPrice), stockQuantity: Number(stockQuantity), reorderLevel: Number(reorderLevel)
    };
    try {
      if (product) await api.put(`/products/${product.id}`, payload);
      else await api.post("/products", payload);
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{product ? "Edit Product" : "New Product"}</h2>
        <form onSubmit={submit}>
          <label>SKU<input value={sku} onChange={e => setSku(e.target.value.toUpperCase())} placeholder="e.g. RICE-003" required /></label>
          <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premium Rice 25kg" required /></label>
          <label>Category
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— None —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {categories.length === 0 && <span className="field-hint">No categories yet — create one on the Categories page first.</span>}
          </label>
          <label>Brand
            <select value={brandId} onChange={e => setBrandId(e.target.value)}>
              <option value="">— None —</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {brands.length === 0 && <span className="field-hint">No brands yet — create one on the Brands page first.</span>}
          </label>
          <label>Unit
            <select value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">— None —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {units.length === 0 && <span className="field-hint">No units yet — create one on the Units page first.</span>}
          </label>
          <label>Unit Price (GHS)<input type="number" step="0.01" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required /></label>
          <label>Stock Quantity<input type="number" min="0" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} required /></label>
          <label>Reorder Level<input type="number" min="0" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} required /></label>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
