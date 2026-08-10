import React, { useEffect, useState } from "react";
import { Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import BarcodeSVG from "@/components/admin/BarcodeSVG";

export default function AdminBarcodes() {
  const [products, setProducts] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(/** @type {string[]} */ ([]));
  const [custom, setCustom] = useState("");

  const load = async () => {
    setLoading(true);
    try { 
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      setProducts(data || []); 
    }
    catch (e) { 
      console.error(e); 
    }
    setLoading(false);
  };
  
  useEffect(() => { load(); }, []);

  const filtered = products.filter((/** @type {any} */ p) => !query || p.name?.toLowerCase().includes(query.toLowerCase()) || p.sku?.toLowerCase().includes(query.toLowerCase()));

  const toggle = (/** @type {string} */ id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAll = () => setSelected(filtered.map((/** @type {any} */ p) => p.id));
  const clearAll = () => setSelected([]);

  const labelProducts = products.filter((/** @type {any} */ p) => selected.includes(p.id));
  const customValue = custom.trim() || `MA-${Date.now().toString().slice(-8)}`;

  const print = () => window.print();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="label-mono text-muted-foreground mb-2">— Identification</p>
          <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-none">Barcodes.</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 border hairline px-4 py-3 label-mono hover:bg-muted"><RefreshCw size={14} /> Refresh</button>
          <button onClick={print} className="flex items-center gap-2 bg-foreground text-background px-5 py-3 label-mono hover:opacity-85"><Printer size={15} /> Print Sheet</button>
        </div>
      </header>

      {/* Custom generator */}
      <div className="border hairline p-6 print:hidden">
        <p className="label-mono text-muted-foreground text-[9px] mb-4">Single Label Generator</p>
        <div className="flex flex-wrap items-center gap-4">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Enter any value (defaults to auto SKU)" className="flex-1 min-w-[220px] border hairline px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground" />
          <div className="border hairline p-4 bg-white">
            <BarcodeSVG value={customValue} height={70} />
          </div>
        </div>
      </div>

      {/* Product picker */}
      {loading ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="print:hidden">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 border hairline px-3 py-2 flex-1 min-w-[200px] max-w-sm">
              <Search size={15} className="text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="bg-transparent text-sm w-full focus:outline-none" />
            </div>
            <button onClick={selectAll} className="label-mono text-[9px] border hairline px-3 py-2 hover:bg-muted">Select Visible</button>
            <button onClick={clearAll} className="label-mono text-[9px] border hairline px-3 py-2 hover:bg-muted">Clear</button>
            <span className="label-mono text-muted-foreground text-[9px]">{selected.length} selected</span>
          </div>

          <div className="border hairline max-h-[360px] overflow-y-auto divide-y hairline">
            {filtered.map((/** @type {any} */ p) => (
              <label key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 accent-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  <p className="label-mono text-muted-foreground text-[9px]">SKU {p.sku || "—"} · Barcode {p.barcode || "—"}</p>
                </div>
                <span className="font-mono text-xs text-muted-foreground">${(p.price || 0).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Printable label sheet */}
      <div className="border hairline p-6 print:border-0 print:p-0">
        <p className="label-mono text-muted-foreground text-[9px] mb-4 print:hidden">Print Preview — {labelProducts.length} labels</p>
        {labelProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select products to generate a printable label sheet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {labelProducts.map((/** @type {any} */ p) => (
              <div key={p.id} className="border hairline p-4 text-center bg-white">
                <p className="text-[10px] truncate mb-1">{p.name}</p>
                <p className="label-mono text-muted-foreground text-[8px] mb-2">${(p.price || 0).toFixed(2)}</p>
                <BarcodeSVG value={p.barcode || p.sku || p.id.slice(-10)} height={56} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}