'use client';
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

interface Alias { id: string; alias: string }

/** Other names this product is known by (used to match messy names in Excel imports). */
export default function AliasEditor({ productId }: { productId: string }) {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get<Alias[]>(`/product-aliases?productId=${productId}`).then(setAliases).catch(() => {});
  useEffect(() => { load(); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!text.trim()) return;
    setError("");
    try { await api.post("/product-aliases", { productId, alias: text }); setText(""); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not add alias"); }
  }
  async function remove(id: string) { try { await api.delete(`/product-aliases/${id}`); load(); } catch { /* ignore */ } }

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <strong style={{ fontSize: 13 }}>Other names (aliases)</strong>
      <p className="field-hint">Names branches may type in Excel files, such as &quot;Coke 330&quot;. They are matched to this product on import.</p>
      <div className="chips">{aliases.map(a => <button key={a.id} type="button" className="chip" title="Remove" onClick={() => remove(a.id)}>{a.alias} &times;</button>)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add another name" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="secondary" onClick={add}>Add</button>
      </div>
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
