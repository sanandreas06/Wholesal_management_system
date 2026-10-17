'use client';
import { FormEvent, useEffect, useState } from "react";
import AppShell from "./AppShell";
import { api, ApiError } from "../lib/api";
import { toast } from "../lib/toast";
import { exportCsv } from "../lib/exportCsv";
import SavedViews from "./SavedViews";
import AliasEditor from "./AliasEditor";
import { usePermissions } from "../hooks/usePermissions";
import { currencySymbol, money } from "../lib/format";
import { shrinkImage } from "../lib/image";
import ProductThumb from "./home/ProductThumb";

interface Ref { id: string; name: string }
interface Product {
  id: string; sku: string; name: string; unitPrice: string | number; costPrice?: string | number | null; stockQuantity: number; reorderLevel: number;
  categoryRef: Ref | null; brand: Ref | null; unit: Ref | null;
  /** small picture for lists; the full one comes from /products/:id */
  imageThumb?: string | null;
}


export default function ProductsManager() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Ref[]>([]);
  const [brands, setBrands] = useState<Ref[]>([]);
  const [units, setUnits] = useState<Ref[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [fCategory, setFCategory] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const [canCreate, canUpdate, canDelete, canProfit] = usePermissions("PRODUCTS:CREATE", "PRODUCTS:UPDATE", "PRODUCTS:DELETE", "PROFIT:READ");

  function load() {
    api.get<Product[]>(`/products${lowStockOnly ? "?lowStock=true" : ""}`).then(setProducts).catch(e => setError(e.message));
    api.get<Ref[]>("/categories").then(setCategories).catch(() => {});
    api.get<Ref[]>("/brands").then(setBrands).catch(() => {});
    api.get<Ref[]>("/units").then(setUnits).catch(() => {});
  }
  useEffect(load, [lowStockOnly]);
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get("new") === "1") setEditing("new"); setFCategory(q.get("category") ?? ""); }, []);

  async function remove(product: Product) {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    try { await api.delete(`/products/${product.id}`); load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  const shown = (products ?? []).filter(p => !fCategory || p.categoryRef?.name === fCategory);

  return (
    <AppShell title="Products">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{products ? `${shown.length} product${shown.length === 1 ? "" : "s"}${fCategory ? ` in ${fCategory}` : ""}` : "Loading..."}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
          <SavedViews storageKey="products" current={{ lowStockOnly, fCategory }} onApply={v => { setLowStockOnly(v.lowStockOnly); setFCategory(v.fCategory); }} />
          <button type="button" className="secondary" disabled={!shown.length} onClick={() => exportCsv("products", [
            { header: "SKU", value: p => p.sku }, { header: "Name", value: p => p.name }, { header: "Category", value: p => p.categoryRef?.name },
            { header: "Brand", value: p => p.brand?.name }, { header: "Unit", value: p => p.unit?.name }, { header: "Price", value: p => Number(p.unitPrice) },
            ...(canProfit ? [{ header: "Cost", value: (p: Product) => (p.costPrice == null ? "" : Number(p.costPrice)) }] : []),
            { header: "Stock", value: p => p.stockQuantity }, { header: "Reorder level", value: p => p.reorderLevel },
          ], shown)}>Export CSV</button>
          <label className="checkbox-row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} />
            Low stock only
          </label>
          {canCreate && <button onClick={() => setEditing("new")}>+ New Product</button>}
        </div>
      </div>
      <div className="table-wrap">
        {products && shown.length === 0 && <div className="empty">No products{lowStockOnly ? " below reorder level" : ""}{fCategory ? ` in ${fCategory}` : ""}.</div>}
        {products && shown.length > 0 && (
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Brand</th><th>Unit</th><th>Price</th>{canProfit && <><th>Cost</th><th>Margin</th></>}<th>Stock</th><th>Reorder At</th><th></th></tr></thead>
            <tbody>
              {shown.map(p => {
                const low = p.stockQuantity <= p.reorderLevel;
                return (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td><span className="pname"><ProductThumb name={p.name} src={p.imageThumb} size={34} />{p.name}</span></td>
                    <td>{p.categoryRef?.name || "—"}</td>
                    <td>{p.brand?.name || "—"}</td>
                    <td>{p.unit?.name || "—"}</td>
                    <td>{money.format(Number(p.unitPrice))}</td>
                    {canProfit && <>
                      <td>{p.costPrice == null ? <span className="muted">not set</span> : money.format(Number(p.costPrice))}</td>
                      <td>{p.costPrice == null || Number(p.unitPrice) <= 0 ? "—" : (() => { const m = ((Number(p.unitPrice) - Number(p.costPrice)) / Number(p.unitPrice)) * 100; return <span className={`badge ${m < 10 ? "inactive" : "active"}`}>{m.toFixed(1)}%</span>; })()}</td>
                    </>}
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
          categories={categories} brands={brands} units={units} canProfit={canProfit}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); toast.success("Product saved"); }}
        />
      )}
    </AppShell>
  );
}

function ProductModal({ product, categories, brands, units, canProfit, onClose, onSaved }: {
  product: Product | null; categories: Ref[]; brands: Ref[]; units: Ref[]; canProfit: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [sku, setSku] = useState(product?.sku || "");
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.categoryRef?.id || "");
  const [brandId, setBrandId] = useState(product?.brand?.id || "");
  const [unitId, setUnitId] = useState(product?.unit?.id || "");
  const [unitPrice, setUnitPrice] = useState(product ? String(product.unitPrice) : "");
  const [costPrice, setCostPrice] = useState(product?.costPrice != null ? String(product.costPrice) : "");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState(product ? String(product.reorderLevel) : "10");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // picture: undefined = unchanged, "" = remove, data URL = new one
  const [image, setImage] = useState<{ full: string; thumb: string } | undefined>(undefined);
  const [current, setCurrent] = useState<string | null>(product?.imageThumb ?? null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (!product?.imageThumb) return;
    api.get<{ imageUrl?: string | null }>(`/products/${product.id}`).then(p => { if (p.imageUrl) setCurrent(p.imageUrl); }).catch(() => {});
  }, [product]);
  async function pickImage(f: File | undefined) {
    if (!f) return;
    setPicking(true); setError("");
    try {
      const [full, thumb] = await Promise.all([shrinkImage(f, { maxSide: 640, maxChars: 68000 }), shrinkImage(f, { maxSide: 128, maxChars: 13000 })]);
      setImage({ full, thumb });
    } catch (e) { setError((e as Error).message); }
    finally { setPicking(false); }
  }
  const shownImage = image === undefined ? current : image.full || null;

  const price = Number(unitPrice), cost = Number(costPrice);
  const showMargin = canProfit && unitPrice !== "" && costPrice !== "" && price > 0;
  const margin = showMargin ? ((price - cost) / price) * 100 : 0;
  const profit = showMargin ? price - cost : 0;

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const payload = {
      sku: sku.trim(), name: name.trim(),
      categoryId: categoryId || undefined, brandId: brandId || undefined, unitId: unitId || undefined,
      unitPrice: Number(unitPrice), ...(canProfit && costPrice !== "" ? { costPrice: Number(costPrice) } : {}),
      reorderLevel: Number(reorderLevel),
      ...(image !== undefined ? { imageUrl: image.full, imageThumb: image.thumb } : {}),
      // stock on an existing product changes only through stock adjustments, so it stays in the ledger
      ...(product ? {} : { stockQuantity: Number(stockQuantity) })
    };
    try {
      if (product) await api.put(`/products/${product.id}`, payload);
      else await api.post("/products", payload);
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  const select = (label: string, value: string, set: (v: string) => void, list: Ref[], page: string) => (
    <label>{label}
      <select value={value} onChange={e => set(e.target.value)}>
        <option value="">Not set</option>
        {list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {list.length === 0 && <span className="field-hint">None yet. Add one on the {page} page.</span>}
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pm" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <div className="pm-head">
          <h2>{product ? "Edit product" : "New product"}</h2>
          <p className="muted">{product ? `${product.sku} · ${product.stockQuantity} in stock` : "Fill in the essentials. You can add more detail later."}</p>
        </div>
        <form onSubmit={submit} className="pm-form">
          <section>
            <h4>Basics</h4>
            <div className="form-grid">
              <label>SKU<input value={sku} onChange={e => setSku(e.target.value.toUpperCase())} placeholder="e.g. RICE-003" required autoFocus={!product} /><span className="field-hint">A short code that is unique to this product.</span></label>
              <label>Product name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premium Rice 25kg" required /></label>
            </div>
          </section>

          <section>
            <h4>Picture</h4>
            <div className="pm-pic">
              <label className="pm-pic-box" aria-label={shownImage ? "Change the picture" : "Add a picture"}>
                {shownImage ? <img src={shownImage} alt="" /> : <span>{picking ? "..." : "+"}<small>{picking ? "Preparing" : "Add picture"}</small></span>}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <div className="pm-pic-text">
                <p className="muted fine">A clear photo of the product or its pack helps staff pick the right item. It is made smaller for you.</p>
                {shownImage && <button type="button" className="secondary" onClick={() => setImage({ full: "", thumb: "" })}>Remove picture</button>}
              </div>
            </div>
          </section>

          <section>
            <h4>Classification</h4>
            <div className="form-grid three">
              {select("Category", categoryId, setCategoryId, categories, "Categories")}
              {select("Brand", brandId, setBrandId, brands, "Brands")}
              {select("Unit", unitId, setUnitId, units, "Units")}
            </div>
          </section>

          <section>
            <h4>Pricing</h4>
            <div className="form-grid">
              <label>Selling price ({currencySymbol()})<input type="number" step="0.01" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" required /></label>
              {canProfit && (
                <label>Cost price ({currencySymbol()})<input type="number" step="0.01" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="What one unit costs you" />
                  <span className="field-hint">Updates itself when you receive goods on a purchase order.</span></label>
              )}
            </div>
            {showMargin && (
              <div className={"margin-chip " + (margin < 10 ? "low" : "ok")}>
                Profit per unit <strong>{money.format(profit)}</strong> · margin <strong>{margin.toFixed(1)}%</strong>
                {margin < 10 && <span> · thin margin, check the prices</span>}
              </div>
            )}
          </section>

          <section>
            <h4>Stock</h4>
            <div className="form-grid">
              {product ? (
                <label>On hand now<input value={product.stockQuantity} readOnly disabled /><span className="field-hint">To change stock, use Stock Adjustments so there is a record of why.</span></label>
              ) : (
                <label>Opening stock<input type="number" min="0" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} required /><span className="field-hint">How many you have right now. Use 0 if none yet.</span></label>
              )}
              <label>Reorder level<input type="number" min="0" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} required /><span className="field-hint">You get a low-stock alert at or below this number.</span></label>
            </div>
          </section>

          {product && <section><AliasEditor productId={product.id} /></section>}
          {error && <div className="error">{error}</div>}
          <div className="pm-foot">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button disabled={saving}>{saving ? "Saving..." : product ? "Save changes" : "Create product"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
