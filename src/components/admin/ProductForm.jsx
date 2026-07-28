import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const GENDERS = ["unisex", "men", "women"];
const STATUSES = ["active", "archived"];

export default function ProductForm({ open, onClose, onSaved, product, categories, brands }) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: "", slug: "", description: "", price: "", cost_price: "", discount_price: "",
    sku: "", barcode: "", stock: "", material: "", gender: "unisex",
    sizes: "", colors: "", images: "", category_id: "", brand_id: "",
    status: "active", featured: false, is_new: false, is_best_seller: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name || "", slug: product.slug || "", description: product.description || "",
        price: product.price ?? "", cost_price: product.cost_price ?? "", discount_price: product.discount_price ?? "",
        sku: product.sku || "", barcode: product.barcode || "", stock: product.stock ?? "",
        material: product.material || "", gender: product.gender || "unisex",
        sizes: (product.sizes || []).join(", "), colors: (product.colors || []).join(", "),
        images: (product.images || []).join("\n"), category_id: product.category_id || "",
        brand_id: product.brand_id || "", status: product.status || "active",
        featured: !!product.featured, is_new: !!product.is_new, is_best_seller: !!product.is_best_seller,
      });
    } else {
      setForm({ name: "", slug: "", description: "", price: "", cost_price: "", discount_price: "", sku: "", barcode: "", stock: "", material: "", gender: "unisex", sizes: "", colors: "", images: "", category_id: "", brand_id: "", status: "active", featured: false, is_new: false, is_best_seller: false });
    }
    setErr(null);
  }, [open, product]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || form.name.trim().toLowerCase().replace(/\s+/g, "-"),
        description: form.description.trim(),
        price: Number(form.price),
        cost_price: form.cost_price ? Number(form.cost_price) : undefined,
        discount_price: form.discount_price ? Number(form.discount_price) : undefined,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        stock: Number(form.stock) || 0,
        material: form.material.trim(),
        gender: form.gender,
        sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
        colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
        images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
        category_id: form.category_id || undefined,
        brand_id: form.brand_id || undefined,
        status: form.status,
        featured: form.featured,
        is_new: form.is_new,
        is_best_seller: form.is_best_seller,
      };
      if (isEdit) await base44.entities.Product.update(product.id, payload);
      else await base44.entities.Product.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, opts = {}) => (
    <label className="block">
      <span className="label-mono text-muted-foreground text-[9px]">{label}</span>
      <input
        type={opts.type || "text"}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        step={opts.step}
        className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-background border hairline my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b hairline sticky top-0 bg-background">
          <h2 className="font-display text-xl tracking-[-0.04em]">{isEdit ? "Edit Product" : "New Product"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-6 space-y-5">
          {field("Name *", "name")}
          {field("Slug", "slug")}
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px]">Description</span>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground" />
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {field("Price *", "price", { type: "number", step: "0.01" })}
            {field("Cost Price", "cost_price", { type: "number", step: "0.01" })}
            {field("Discount Price", "discount_price", { type: "number", step: "0.01" })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {field("SKU", "sku")}
            {field("Barcode", "barcode")}
            {field("Stock", "stock", { type: "number" })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("Material", "material")}
            <label className="block">
              <span className="label-mono text-muted-foreground text-[9px]">Gender</span>
              <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground">
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("Sizes (comma)", "sizes")}
            {field("Colors (comma)", "colors")}
          </div>
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px]">Images (one URL per line)</span>
            <textarea value={form.images} onChange={(e) => set("images", e.target.value)} rows={3} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground font-mono text-xs" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label-mono text-muted-foreground text-[9px]">Category</span>
              <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground">
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label-mono text-muted-foreground text-[9px]">Brand</span>
              <select value={form.brand_id} onChange={(e) => set("brand_id", e.target.value)} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground">
                <option value="">—</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px]">Status</span>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-foreground">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-5 pt-1">
            {[
              ["featured", "Featured"], ["is_new", "New"], ["is_best_seller", "Best Seller"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 label-mono text-[10px] cursor-pointer">
                <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} className="accent-foreground w-4 h-4" />
                {label}
              </label>
            ))}
          </div>
          {err && <p className="text-destructive text-sm">{err}</p>}
          <div className="flex gap-3 pt-2 border-t hairline">
            <button type="submit" disabled={saving} className="flex-1 bg-foreground text-background py-3.5 label-mono hover:opacity-85 disabled:opacity-40">
              {saving ? "Saving…" : isEdit ? "Update Product" : "Create Product"}
            </button>
            <button type="button" onClick={onClose} className="px-6 border hairline py-3.5 label-mono hover:bg-muted">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}