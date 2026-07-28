import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import ProductForm from "@/components/admin/ProductForm";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ps, cs, bs] = await Promise.all([
        base44.entities.Product.list("-created_date", 200),
        base44.entities.Category.list("-created_date", 100),
        base44.entities.Brand.list("-created_date", 100),
      ]);
      setProducts(ps); setCategories(cs); setBrands(bs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const catName = (id) => categories.find((c) => c.id === id)?.name || "—";
  const brandName = (id) => brands.find((b) => b.id === id)?.name || "—";

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [products, query, statusFilter]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p) => { setEditing(p); setFormOpen(true); };
  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await base44.entities.Product.delete(p.id);
    load();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-muted-foreground mb-2">— Inventory</p>
          <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-none">Products.</h1>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-foreground text-background px-5 py-3 label-mono hover:opacity-85">
          <Plus size={15} /> New Product
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 border hairline px-3 py-2 flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, SKU, barcode…" className="bg-transparent text-sm w-full focus:outline-none" />
        </div>
        <div className="flex border hairline">
          {["all", "active", "archived"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 label-mono text-[9px] capitalize ${statusFilter === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="border hairline overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b hairline">
                {["", "Name", "Category", "Brand", "Price", "Stock", "Status", "Flags", ""].map((h) => (
                  <th key={h} className="label-mono text-[9px] text-muted-foreground text-left px-4 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y hairline">
              {filtered.map((p) => {
                const hasDiscount = p.discount_price != null && p.discount_price < p.price;
                return (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="w-10 h-12 overflow-hidden bg-muted">
                        {p.images?.[0] && <Image src={p.images[0]} alt="" className="w-full h-full" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="label-mono text-muted-foreground text-[9px] mt-0.5">{p.sku || "—"}</p>
                    </td>
                    <td className="px-4 py-3 label-mono text-[9px] text-muted-foreground">{catName(p.category_id)}</td>
                    <td className="px-4 py-3 label-mono text-[9px] text-muted-foreground">{brandName(p.brand_id)}</td>
                    <td className="px-4 py-3 font-mono">
                      {hasDiscount ? (
                        <div>
                          <span>${p.discount_price.toFixed(2)}</span>
                          <span className="block text-[10px] text-muted-foreground line-through">${p.price.toFixed(2)}</span>
                        </div>
                      ) : <span>${p.price.toFixed(2)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono ${p.stock <= 0 ? "text-destructive" : p.stock <= 5 ? "text-amber-600" : ""}`}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`label-mono text-[9px] px-2 py-1 ${p.status === "active" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.featured && <span className="label-mono text-[8px] text-muted-foreground">F</span>}
                        {p.is_new && <span className="label-mono text-[8px] text-muted-foreground">N</span>}
                        {p.is_best_seller && <span className="label-mono text-[8px] text-muted-foreground">B</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-muted"><Pencil size={14} /></button>
                        <button onClick={() => remove(p)} className="p-1.5 hover:bg-muted text-destructive"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} product={editing} categories={categories} brands={brands} />
    </div>
  );
}