import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";

/** @type {any} */
const Image = BaseImage;

export default function SearchOverlay(/** @type {{ open: boolean, onClose: () => void }} */ { open, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setQ(""); setResults([]); return; }
    const onKey = (/** @type {KeyboardEvent} */ e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // Fetch products and filter locally exactly as the old code did for speed/fuzzy matching
        const { data: all } = await supabase.from('products').select('*').limit(200);
        
        if (all) {
          const ql = q.toLowerCase();
          const filtered = all.filter((/** @type {any} */ p) =>
            p.name?.toLowerCase().includes(ql) ||
            p.sku?.toLowerCase().includes(ql) ||
            p.barcode?.includes(ql) ||
            p.material?.toLowerCase().includes(ql)
          ).slice(0, 6);
          setResults(filtered);
        } else {
          setResults([]);
        }
      } catch { setResults([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute top-0 left-0 right-0 bg-background inertia-up">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center gap-4 border-b hairline pb-4">
            <Search size={20} strokeWidth={1.5} className="text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, SKU, barcode…"
              className="flex-1 bg-transparent outline-none font-display text-2xl md:text-4xl tracking-[-0.04em] placeholder:text-muted-foreground/50"
            />
            <button onClick={onClose} aria-label="Close search"><X size={20} strokeWidth={1.5} /></button>
          </div>

          {q.trim() && (
            <div className="py-6">
              {loading ? (
                <p className="label-mono text-muted-foreground">Searching…</p>
              ) : results.length === 0 ? (
                <p className="label-mono text-muted-foreground">No objects found for "{q}".</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {results.map((/** @type {any} */ p) => (
                    <Link key={p.id} to={`/product/${p.id}`} onClick={onClose} className="group block">
                      <div className="aspect-[4/5] bg-muted overflow-hidden">
                        {p.images?.[0] && <Image src={p.images[0]} alt={p.name} className="w-full h-full group-hover:scale-105 transition-transform duration-700" fittingType="fill" />}
                      </div>
                      <p className="text-xs mt-2 truncate">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">${p.price?.toFixed(2)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}