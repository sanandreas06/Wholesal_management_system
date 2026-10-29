'use client';
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { barcodeSvg, findUrl, isEan13, qrSvgString } from "../../lib/barcode";

interface Label { code: string; name: string; sku: string; price?: number }
type Size = "roll" | "a4";

/**
 * Printable labels. Item labels (?ref= from a goods-in or label run, or ?codes=) carry the item's own code;
 * product labels (?product=<id>&n=10) carry the product's barcode, for goods that came without one.
 * Each label has a Code 128 barcode (read by any USB scanner) and a QR code (read by phone cameras).
 */
export default function LabelSheet() {
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [company, setCompany] = useState("");
  const [size, setSize] = useState<Size>("roll");
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"item" | "product">("item");

  useEffect(() => {
    try { const s = localStorage.getItem("wms_label_size"); if (s === "a4" || s === "roll") setSize(s); } catch { /* ignore */ }
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("ref"), codes = q.get("codes"), n = Math.min(500, Math.max(1, Number(q.get("n")) || 1));
    // product labels: ?product=<id>&n=10, or several at once ?products=<id>:12,<id>:24 (after goods in)
    const wanted = q.get("products") ? q.get("products")!.split(",").map(x => x.split(":")).map(([id, k]) => ({ id, n: Math.min(500, Math.max(1, Number(k) || 1)) })) : q.get("product") ? [{ id: q.get("product")!, n }] : [];
    if (wanted.length) {
      setKind("product");
      Promise.all(wanted.map(w => api.get<{ name: string; sku: string; ownCode?: string | null; barcodes?: string[]; unitPrice: string | number; needsPrice?: boolean }>(`/products/${w.id}`).then(p => {
        const code = p.ownCode ?? p.barcodes?.[0] ?? p.sku;
        return Array.from({ length: w.n }, () => ({ code, name: p.name, sku: p.sku, price: p.needsPrice ? undefined : Number(p.unitPrice) }));
      }))).then(all => setLabels(all.flat().slice(0, 1000))).catch(e => setError(e instanceof ApiError ? e.message : "Could not load the product."));
      api.get<{ name: string }>("/organization/brand").then(b => setCompany(b.name ?? "")).catch(() => undefined);
      return;
    }
    if (!ref && !codes) { setError("Nothing to print. Open labels from Goods in, Item tracking or a product."); return; }
    api.get<{ company: string; labels: Label[] }>(`/tracking/labels?${ref ? `reference=${encodeURIComponent(ref)}` : `codes=${encodeURIComponent(codes!)}`}`)
      .then(r => { setLabels(r.labels); setCompany(r.company); })
      .catch(e => setError(e instanceof ApiError ? e.message : "Could not load the labels."));
  }, []);

  function pick(s: Size) { setSize(s); try { localStorage.setItem("wms_label_size", s); } catch { /* ignore */ } }

  return (
    <div className={`lb lb-${size}`}>
      <style>{size === "roll" ? "@page { size: 50mm 30mm; margin: 0 }" : "@page { size: A4; margin: 10mm 8mm }"}</style>
      <div className="lb-bar no-print">
        <a href="/scan" className="lb-back">← Back</a>
        <div className="lb-title"><b>{labels ? `${labels.length} label${labels.length === 1 ? "" : "s"}` : "Labels"}</b><span>{kind === "item" ? "Stick one on each item. Every label is different." : "The product's own WHOLESTRA code: the barcode is for selling, the QR for finding it."}</span></div>
        <div className="lb-size" role="radiogroup" aria-label="Label size">
          <button role="radio" aria-checked={size === "roll"} className={size === "roll" ? "on" : ""} onClick={() => pick("roll")}>Label printer 50×30 mm</button>
          <button role="radio" aria-checked={size === "a4"} className={size === "a4" ? "on" : ""} onClick={() => pick("a4")}>A4 sticker sheet</button>
        </div>
        <button className="lb-print" disabled={!labels?.length} onClick={() => window.print()}>Print</button>
      </div>
      {error && <div className="error no-print">{error}</div>}
      {labels && (
        <div className="lb-sheet">
          {labels.map((l, i) => (
            <div className="lb-label" key={`${l.code}-${i}`}>
              <div className="lb-top"><span className="lb-co">{company}</span>{kind === "product" && l.price !== undefined && <span className="lb-price">{l.price.toFixed(2)}</span>}</div>
              <div className="lb-name">{l.name}</div>
              <div className="lb-codes">
                <div className={"lb-bars" + (isEan13(l.code) ? " ean" : "")} dangerouslySetInnerHTML={{ __html: barcodeSvg(l.code, 40) }} />
                <div className="lb-qr" dangerouslySetInnerHTML={{ __html: qrSvgString(findUrl(l.code), 64) }} />
              </div>
              {kind === "item" ? <div className="lb-code">{l.code}</div> : <div className="lb-legend"><span>Scan to sell</span><span>Scan to find</span></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
