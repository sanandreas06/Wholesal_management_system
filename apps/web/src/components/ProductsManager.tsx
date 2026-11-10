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
import CameraScanner from "./CameraScanner";
import { barcodeSvg } from "../lib/barcode";
import { BrandPicker, CategoryPicker } from "./products/Pickers";

interface Ref { id: string; name: string }
interface Product {
  id: string; sku: string; name: string; unitPrice: string | number; costPrice?: string | number | null; stockQuantity: number; reorderLevel: number;
  categoryRef: Ref | null; brand: Ref | null; unit: Ref | null;
  /** small picture for lists; the full one comes from /products/:id */
  imageThumb?: string | null;
  /** barcodes on the product or its carton; scanning any of them finds it */
  barcodes?: string[];
  /** a WHOLESTRA label on every single item, so each one can be traced */
  trackItems?: boolean;
  /** added by the store while scanning goods in: cannot be sold until a selling price is set */
  needsPrice?: boolean;
  /** the product's own permanent WHOLESTRA code (on its labels); also the first of `barcodes` */
  ownCode?: string | null;
  /** types of one product (a diffuser in Gardenia, Lilac...) share a group */
  groupId?: string | null; variant?: string | null;
}
interface TypeRow { name: string; stock: string; price: string; barcode: string }
interface Sibling { id: string; sku: string; name: string; variant: string | null; stockQuantity: number }


export default function ProductsManager() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Ref[]>([]);
  const [brands, setBrands] = useState<Ref[]>([]);
  const [units, setUnits] = useState<Ref[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [fCategory, setFCategory] = useState("");
  const [needsPriceOnly, setNeedsPriceOnly] = useState(false);
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
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get("new") === "1") setEditing("new"); setFCategory(q.get("category") ?? ""); setNeedsPriceOnly(q.get("needsPrice") === "1"); }, []);

  async function remove(product: Product) {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    try { await api.delete(`/products/${product.id}`); load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  // the types of one product stay together in the list, in the order they were made
  const ordered = (() => {
    const list = products ?? [], first = new Map<string, number>();
    list.forEach((p, i) => { if (p.groupId && !first.has(p.groupId)) first.set(p.groupId, i); });
    return list.map((p, i) => ({ p, k: p.groupId ? first.get(p.groupId)! + i / 1e6 : i })).sort((a, b) => a.k - b.k).map(x => x.p);
  })();
  const shown = ordered.filter(p => (!fCategory || p.categoryRef?.name === fCategory) && (!needsPriceOnly || p.needsPrice));
  const unpriced = (products ?? []).filter(p => p.needsPrice).length;

  return (
    <AppShell title="Products">
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <p className="muted">{products ? `${shown.length} product${shown.length === 1 ? "" : "s"}${fCategory ? ` in ${fCategory}` : ""}` : "Loading..."}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
          <SavedViews storageKey="products" current={{ lowStockOnly, fCategory }} onApply={v => { setLowStockOnly(v.lowStockOnly); setFCategory(v.fCategory); }} />
          <button type="button" className="secondary" disabled={!shown.length} onClick={() => exportCsv("products", [
            { header: "SKU", value: p => p.sku }, { header: "WHOLESTRA code", value: p => p.ownCode ?? "" }, { header: "Name", value: p => p.name }, { header: "Category", value: p => p.categoryRef?.name },
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
      {(unpriced > 0 || needsPriceOnly) && <div className="pm-needs-price">
        <span><b>{unpriced} new product{unpriced === 1 ? "" : "s"} added while scanning goods in {unpriced === 1 ? "needs" : "need"} a selling price.</b> They are in stock but cannot be sold until priced.</span>
        <button className="secondary" onClick={() => setNeedsPriceOnly(v => !v)}>{needsPriceOnly ? "Show all products" : "Show them"}</button>
      </div>}
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
                    <td><span className="pname"><ProductThumb name={p.name} src={p.imageThumb} size={34} />{p.name}{p.variant && <span className="pm-type-tag">Type</span>}</span></td>
                    <td>{p.categoryRef?.name || "—"}</td>
                    <td>{p.brand?.name || "—"}</td>
                    <td>{p.unit?.name || "—"}</td>
                    <td>{p.needsPrice ? <span className="badge high">Set a price</span> : money.format(Number(p.unitPrice))}</td>
                    {canProfit && <>
                      <td>{p.costPrice == null ? <span className="muted">not set</span> : money.format(Number(p.costPrice))}</td>
                      <td>{p.costPrice == null || Number(p.unitPrice) <= 0 ? "—" : (() => { const m = ((Number(p.unitPrice) - Number(p.costPrice)) / Number(p.unitPrice)) * 100; return <span className={`badge ${m < 10 ? "inactive" : "active"}`}>{m.toFixed(1)}%</span>; })()}</td>
                    </>}
                    <td><span className={`badge ${low ? "inactive" : "active"}`}>{p.stockQuantity}</span></td>
                    <td>{p.reorderLevel}</td>
                    <td className="row-actions">
                      {canUpdate && <button className="secondary" onClick={() => setEditing(p)}>Edit</button>}
                      {p.ownCode && <a className="button secondary" href={`/labels?product=${p.id}&n=${Math.max(1, Math.min(500, p.stockQuantity))}`} target="_blank" rel="noreferrer" title={`Print labels with code ${p.ownCode}`}>Labels</a>}
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
          onOpenType={id => { const t = (products ?? []).find(x => x.id === id); if (t) setEditing(t); }}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); toast.success("Product saved"); }}
        />
      )}
    </AppShell>
  );
}

function ProductModal({ product, categories, brands, units, canProfit, onClose, onSaved, onOpenType }: {
  product: Product | null; categories: Ref[]; brands: Ref[]; units: Ref[]; canProfit: boolean; onClose: () => void; onSaved: () => void; onOpenType: (id: string) => void;
}) {
  const [sku, setSku] = useState(product?.sku || "");
  const [name, setName] = useState(product?.name || "");
  // chosen by name from the ready-made lists (or typed under "Other"); the server makes the company's records itself
  const [category, setCategory] = useState(product?.categoryRef?.name || "");
  const [brand, setBrand] = useState(product?.brand?.name || "");
  // a new product in several types (one row each); an existing one shows its other types and can get another
  const [hasTypes, setHasTypes] = useState(false);
  const [types, setTypes] = useState<TypeRow[]>([{ name: "", stock: "0", price: "", barcode: "" }, { name: "", stock: "0", price: "", barcode: "" }]);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [newType, setNewType] = useState({ name: "", stock: "0" });
  const [addingType, setAddingType] = useState(false);
  useEffect(() => { if (product) api.get<Sibling[]>(`/products/${product.id}/types`).then(setSiblings).catch(() => setSiblings([])); }, [product]);
  const setType = (i: number, k: keyof TypeRow, v: string) => setTypes(ts => ts.map((t, j) => j === i ? { ...t, [k]: v } : t));
  async function addType() {
    if (!product || !newType.name.trim()) return;
    setAddingType(true); setError("");
    try {
      const made = await api.post<Product>(`/products/${product.id}/types`, { name: newType.name.trim(), stockQuantity: Number(newType.stock) || 0 });
      toast.success(`Added "${made.name}"`); setNewType({ name: "", stock: "0" });
      setSiblings(await api.get<Sibling[]>(`/products/${product.id}/types`));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not add the type"); }
    finally { setAddingType(false); }
  }
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
  // the maker's barcodes; the product's own WHOLESTRA code is shown apart and can never be removed
  const [barcodes, setBarcodes] = useState<string[]>((product?.barcodes ?? []).filter(b => b !== product?.ownCode));
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [trackItems, setTrackItems] = useState(!!product?.trackItems);
  // a new product follows the company switch "Every item gets its own label"
  useEffect(() => { if (!product) api.get<{ on: boolean }>("/tracking/track-all").then(r => { if (r.on) setTrackItems(true); }).catch(() => {}); }, [product]);
  const [labelCount, setLabelCount] = useState("10");
  const [suggest, setSuggest] = useState<{ name: string; source: string } | null>(null);
  const addCode = (c: string) => {
    const v = c.trim(); if (v && !barcodes.includes(v)) setBarcodes(b => [...b, v].slice(0, 10)); setCode("");
    // a new product: look the barcode up in the free product lists and offer the name
    if (v && !product) api.get<{ found: boolean; name?: string; source?: string }>(`/products/quick/barcode-info?code=${encodeURIComponent(v)}`)
      .then(i => { if (i.found && i.name) { setSuggest({ name: i.name, source: i.source ?? "" }); setName(n => n || i.name!); } }).catch(() => undefined);
  };
  useEffect(() => {
    if (!product?.imageThumb) return;
    api.get<{ imageUrl?: string | null }>(`/products/${product.id}`).then(p => { if (p.imageUrl) setCurrent(p.imageUrl); }).catch(() => {});
  }, [product]);
  async function pickImage(f: File | undefined) {
    if (!f) return;
    setPicking(true); setError("");
    try {
      // fitted whole into a square on white, whatever the photo's size or shape: no cropping by hand
      const [full, thumb] = await Promise.all([shrinkImage(f, { maxSide: 640, maxChars: 68000, square: true }), shrinkImage(f, { maxSide: 128, maxChars: 13000, square: true })]);
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
    e.preventDefault(); setError("");
    const rows = types.filter(t => t.name.trim());
    if (!product && hasTypes && rows.length < 2) { setError("Add at least two types, or switch off \"comes in different types\"."); return; }
    setSaving(true);
    const payload = {
      sku: sku.trim(), name: name.trim(),
      categoryName: category, brandName: brand, unitId: unitId || undefined,
      unitPrice: Number(unitPrice), ...(canProfit && costPrice !== "" ? { costPrice: Number(costPrice) } : {}),
      reorderLevel: Number(reorderLevel),
      barcodes: code.trim() && !barcodes.includes(code.trim()) ? [...barcodes, code.trim()] : barcodes,
      trackItems,
      ...(image !== undefined ? { imageUrl: image.full, imageThumb: image.thumb } : {}),
      // stock on an existing product changes only through stock adjustments, so it stays in the ledger
      ...(product ? {} : { stockQuantity: Number(stockQuantity) }),
      ...(!product && hasTypes ? { variants: rows.map(t => ({ name: t.name.trim(), stockQuantity: Number(t.stock) || 0, ...(t.price !== "" ? { unitPrice: Number(t.price) } : {}), ...(t.barcode.trim() ? { barcodes: [t.barcode.trim()] } : {}) })) } : {}),
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
              <label>Product name<input value={name} onChange={e => setName(e.target.value)} placeholder={hasTypes ? "e.g. Air Wick Reed Diffuser" : "e.g. Premium Rice 25kg"} required /></label>
            </div>
            <div className="pm-class">
              <CategoryPicker value={category} onChange={setCategory} own={categories.map(c => c.name)} />
              <BrandPicker value={brand} onChange={setBrand} category={category} own={brands.map(b => b.name)} />
            </div>
          </section>

          {!product && (
            <section>
              <h4>Types</h4>
              <label className="pm-track">
                <input type="checkbox" checked={hasTypes} onChange={e => setHasTypes(e.target.checked)} />
                <span><b>This product comes in different types</b>Scents, flavours, colours or sizes, like a diffuser in Gardenia, Lilac, Coffee and Wild Flower. Each type gets its own stock, code and labels, all under one product.</span>
              </label>
              {hasTypes && <div className="pm-types">
                <div className="pm-types-head"><span>Type</span><span>Opening stock</span><span>Price ({currencySymbol()}) <small>if different</small></span><span>Barcode <small>optional</small></span><span /></div>
                {types.map((t, i) => (
                  <div className="pm-type" key={i}>
                    <input value={t.name} onChange={e => setType(i, "name", e.target.value)} placeholder={["e.g. Gardenia", "e.g. Lilac", "e.g. Coffee", "e.g. Wild Flower"][i] ?? "Type name"} aria-label={`Type ${i + 1} name`} maxLength={60} />
                    <label className="pm-tl"><small>Opening stock</small><input type="number" min="0" value={t.stock} onChange={e => setType(i, "stock", e.target.value)} aria-label={`Type ${i + 1} opening stock`} /></label>
                    <label className="pm-tl"><small>Price, if different</small><input type="number" min="0" step="0.01" value={t.price} onChange={e => setType(i, "price", e.target.value)} placeholder={unitPrice || "Same"} aria-label={`Type ${i + 1} price`} /></label>
                    <label className="pm-tl pm-tl-code"><small>Barcode (optional)</small><input value={t.barcode} onChange={e => setType(i, "barcode", e.target.value)} placeholder="Scan or type" aria-label={`Type ${i + 1} barcode`} maxLength={64} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} /></label>
                    <button type="button" className="pm-type-x" onClick={() => setTypes(ts => ts.length > 1 ? ts.filter((_, j) => j !== i) : ts)} aria-label={`Remove type ${i + 1}`} disabled={types.length <= 1}>×</button>
                  </div>
                ))}
                {types.length < 30 && <button type="button" className="secondary pm-type-add" onClick={() => setTypes(ts => [...ts, { name: "", stock: "0", price: "", barcode: "" }])}>+ Add a type</button>}
                {name.trim() && types.some(t => t.name.trim()) && <p className="muted fine">Saved as {types.filter(t => t.name.trim()).slice(0, 3).map(t => `"${name.trim()} – ${t.name.trim()}"`).join(", ")}{types.filter(t => t.name.trim()).length > 3 ? "…" : ""}.</p>}
              </div>}
            </section>
          )}

          {product && (
            <section>
              <h4>Types</h4>
              {siblings.length > 0 && <ul className="pm-sibs">{siblings.map(s => (
                <li key={s.id} className={s.id === product.id ? "on" : ""}>
                  <span><b>{s.variant ?? s.name}</b><small>{s.sku} · {s.stockQuantity} in stock</small></span>
                  {s.id === product.id ? <em>Editing</em> : <button type="button" className="linkish" onClick={() => onOpenType(s.id)}>Open</button>}
                </li>))}</ul>}
              <p className="muted fine">{siblings.length ? "Add another type of this product:" : "Does this product come in other types (scent, flavour, colour, size)? Add one: it gets its own stock, code and labels."}</p>
              <div className="pm-type-new">
                <input value={newType.name} onChange={e => setNewType(t => ({ ...t, name: e.target.value }))} placeholder="New type, e.g. Lilac" aria-label="New type name" maxLength={60} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addType(); } }} />
                <input type="number" min="0" value={newType.stock} onChange={e => setNewType(t => ({ ...t, stock: e.target.value }))} aria-label="Opening stock of the new type" title="Opening stock" />
                <button type="button" className="secondary" disabled={addingType || !newType.name.trim()} onClick={addType}>{addingType ? "Adding…" : "+ Add type"}</button>
              </div>
            </section>
          )}

          <section>
            <h4>Codes</h4>
            <div className="pm-own">
              {product?.ownCode ? <>
                <div className="pm-own-bars" dangerouslySetInnerHTML={{ __html: barcodeSvg(product.ownCode, 40) }} />
                <div className="pm-own-text">
                  <b>WHOLESTRA code {product.ownCode}</b>
                  <span>This product&apos;s own permanent code. It never changes. Print it on labels (or with an ink-jet coder) and stick one on every item: the barcode is scanned to sell, the QR to find it.</span>
                  <span className="pm-print">
                    <input type="number" min={1} max={500} value={labelCount} onChange={e => setLabelCount(e.target.value)} aria-label="How many labels" />
                    <a className="button secondary" href={`/labels?product=${product.id}&n=${Math.max(1, Math.min(500, Number(labelCount) || 1))}`} target="_blank" rel="noreferrer">Print labels</a>
                  </span>
                </div>
              </> : <p className="muted fine">WHOLESTRA gives this product its own permanent code when you save it. You can then print its labels.</p>}
            </div>
            <p className="pm-sub">Maker&apos;s barcodes (optional)</p>
            <div className="pm-codes">
              <div className="pm-code-in">
                {/* a USB scanner types the code and presses Enter: Enter adds it here instead of saving the form */}
                <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCode(code); } }} placeholder="Scan or type the barcode, then Enter" aria-label="Barcode" maxLength={64} />
                <button type="button" className="secondary" onClick={() => setCamera(true)}>📷 Camera</button>
              </div>
              {barcodes.length > 0 && <ul className="pm-code-list">{barcodes.map(b => <li key={b}><code>{b}</code><button type="button" aria-label={`Remove barcode ${b}`} onClick={() => setBarcodes(x => x.filter(y => y !== b))}>×</button></li>)}</ul>}
              {suggest && <p className="pm-suggest">Found in {suggest.source}: <b>{suggest.name}</b>{name !== suggest.name && <> · <button type="button" className="linkish" onClick={() => setName(suggest.name)}>use this name</button></>}</p>}
              <p className="muted fine">Only if you want the code the maker printed to scan too. The WHOLESTRA code above always works, so you can skip this. Scanning a barcode here first fills in the name when it is a known packaged product.</p>
            </div>
            <label className="pm-track">
              <input type="checkbox" checked={trackItems} onChange={e => setTrackItems(e.target.checked)} />
              <span><b>Track each item</b>Every single item gets its own WHOLESTRA label, printed when the goods are scanned in. You can then see where each one is and where it has been. Best for costly goods (engines, gearboxes, phones). Leave off for everyday goods like rice: they are counted by their barcode at every handover.</span>
            </label>
            {camera && <CameraScanner title="Scan the product's barcode" onScan={addCode} onClose={() => setCamera(false)} />}
          </section>

          <section>
            <h4>Picture</h4>
            <div className="pm-pic">
              <label className="pm-pic-box" aria-label={shownImage ? "Change the picture" : "Add a picture"}>
                {shownImage ? <img src={shownImage} alt="" /> : <span>{picking ? "..." : "+"}<small>{picking ? "Preparing" : "Add picture"}</small></span>}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <div className="pm-pic-text">
                <p className="muted fine">Any photo works: it is fitted into a neat square for you, whole and centred, and made smaller. No cropping needed.</p>
                {shownImage && <button type="button" className="secondary" onClick={() => setImage({ full: "", thumb: "" })}>Remove picture</button>}
              </div>
            </div>
          </section>


          <section>
            <h4>Pricing</h4>
            <div className="form-grid">
              <label>Sold by<select value={unitId} onChange={e => setUnitId(e.target.value)}><option value="">Piece (each)</option>{units.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
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
                hasTypes ? <p className="muted fine">Opening stock is set for each type above.</p> :
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
