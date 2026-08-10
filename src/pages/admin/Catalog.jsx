import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminCatalog() {
  const [categories, setCategories] = useState(/** @type {any[]} */ ([]));
  const [brands, setBrands] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [catName, setCatName] = useState("");
  const [brandName, setBrandName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [cs, bs] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('brands').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      setCategories(cs.data || []); 
      setBrands(bs.data || []);
    } catch (e) { 
      console.error(e); 
    }
    setLoading(false);
  };
  
  useEffect(() => { load(); }, []);

  const addCategory = async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await supabase.from('categories').insert({ 
      name: catName.trim(), 
      slug: catName.trim().toLowerCase().replace(/\s+/g, "-") 
    });
    setCatName(""); 
    load();
  };

  const addBrand = async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    await supabase.from('brands').insert({ 
      name: brandName.trim(), 
      slug: brandName.trim().toLowerCase().replace(/\s+/g, "-") 
    });
    setBrandName(""); 
    load();
  };

  const delCat = async (/** @type {any} */ c) => { 
    if (window.confirm(`Delete category "${c.name}"?`)) { 
      await supabase.from('categories').delete().eq('id', c.id); 
      load(); 
    } 
  };
  
  const delBrand = async (/** @type {any} */ b) => { 
    if (window.confirm(`Delete brand "${b.name}"?`)) { 
      await supabase.from('brands').delete().eq('id', b.id); 
      load(); 
    } 
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="label-mono text-muted-foreground mb-2">— Taxonomy</p>
        <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-none">Catalog.</h1>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Categories */}
        <div className="border hairline">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <h2 className="font-display text-xl tracking-[-0.04em]">Categories</h2>
            <span className="label-mono text-muted-foreground text-[9px]">{categories.length} total</span>
          </div>
          <form onSubmit={addCategory} className="px-5 py-4 border-b hairline flex gap-2">
            <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Category name" className="flex-1 border hairline px-3 py-2.5 text-sm focus:outline-none focus:border-foreground" />
            <button type="submit" className="bg-foreground text-background px-4 py-2.5 label-mono flex items-center gap-1.5"><Plus size={14} /> Add</button>
          </form>
          <div className="divide-y hairline">
            {categories.map((/** @type {any} */ c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm">{c.name}</p>
                  <p className="label-mono text-muted-foreground text-[9px]">{c.slug}</p>
                </div>
                <button onClick={() => delCat(c)} className="p-1.5 hover:bg-muted text-destructive"><Trash2 size={14} /></button>
              </div>
            ))}
            {categories.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No categories.</p>}
          </div>
        </div>

        {/* Brands */}
        <div className="border hairline">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <h2 className="font-display text-xl tracking-[-0.04em]">Brands</h2>
            <span className="label-mono text-muted-foreground text-[9px]">{brands.length} total</span>
          </div>
          <form onSubmit={addBrand} className="px-5 py-4 border-b hairline flex gap-2">
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand name" className="flex-1 border hairline px-3 py-2.5 text-sm focus:outline-none focus:border-foreground" />
            <button type="submit" className="bg-foreground text-background px-4 py-2.5 label-mono flex items-center gap-1.5"><Plus size={14} /> Add</button>
          </form>
          <div className="divide-y hairline">
            {brands.map((/** @type {any} */ b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm">{b.name}</p>
                  {b.description && <p className="label-mono text-muted-foreground text-[9px]">{b.description}</p>}
                </div>
                <button onClick={() => delBrand(b)} className="p-1.5 hover:bg-muted text-destructive"><Trash2 size={14} /></button>
              </div>
            ))}
            {brands.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No brands.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}