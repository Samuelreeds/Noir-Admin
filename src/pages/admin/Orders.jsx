import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";

/** @type {any} */
const Image = BaseImage;

const STATUSES = ["pending", "paid", "processing", "shipping", "delivered", "cancelled", "refunded"];

export default function AdminOrders() {
  const [orders, setOrders] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(/** @type {string | null} */ (null));

  const load = async () => {
    setLoading(true);
    try { 
      // Join order_items and profiles to reconstruct the old Base44 JSON layout seamlessly
      const { data, error } = await supabase
        .from('orders')
        .select('*, profiles(full_name, email), order_items(*, products(images))')
        .order('created_at', { ascending: false })
        .limit(200);
        
      if (error) throw error;
      
      const mappedOrders = (data || []).map((/** @type {any} */ o) => ({
        ...o,
        customer_name: o.profiles?.full_name || o.shipping_address?.name || "Guest",
        email: o.shipping_address?.email || o.profiles?.email || "—",
        phone: o.shipping_address?.phone || "—",
        total: Number(o.grand_total) || 0,
        subtotal: Number(o.subtotal) || 0,
        shipping_fee: Number(o.shipping_fee) || 0,
        tax: Number(o.tax) || 0,
        discount: Number(o.discount_total) || 0,
        items: o.order_items?.map((/** @type {any} */ i) => ({
          name: i.product_name,
          image: i.products?.images?.[0] || '',
          size: i.selected_size,
          color: i.selected_color,
          quantity: i.quantity,
          price: Number(i.unit_price)
        })) || []
      }));

      setOrders(mappedOrders); 
    }
    catch (e) { 
      console.error(e); 
    }
    setLoading(false);
  };
  
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter((/** @type {any} */ o) => filter === "all" || o.status === filter), [orders, filter]);

  const updateStatus = async (/** @type {string} */ id, /** @type {string} */ status) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders((prev) => prev.map((/** @type {any} */ o) => (o.id === id ? { ...o, status } : o)));
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="label-mono text-muted-foreground mb-2">— Fulfillment</p>
        <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-none">Orders.</h1>
      </header>

      <div className="flex flex-wrap gap-2 border-b hairline pb-3">
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 label-mono text-[9px] capitalize ${filter === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground border hairline"}`}>
            {s} {s !== "all" && <span className="opacity-60 ml-1">{orders.filter((/** @type {any} */ o) => o.status === s).length}</span>}
          </button>
        ))}
      </div>

      <div className="border hairline divide-y hairline">
        {filtered.map((/** @type {any} */ o) => {
          const open = expanded === o.id;
          return (
            <div key={o.id}>
              <button onClick={() => setExpanded(open ? null : o.id)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/40 text-left">
                <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                <div className="min-w-0 w-40">
                  <p className="text-sm truncate">{o.customer_name}</p>
                  <p className="label-mono text-muted-foreground text-[9px] mt-0.5 truncate">{o.order_number || o.id.slice(-8).toUpperCase()}</p>
                </div>
                <p className="label-mono text-[9px] text-muted-foreground hidden md:block w-44 truncate">{o.email}</p>
                <p className="font-mono text-sm ml-auto">${(o.total || 0).toFixed(2)}</p>
                <span className={`label-mono text-[9px] px-2 py-1 ${o.status === "paid" || o.status === "delivered" ? "bg-foreground text-background" : "bg-muted"}`}>{o.status}</span>
              </button>
              {open && (
                <div className="px-5 pb-6 pt-2 grid md:grid-cols-[1.5fr_1fr_1fr] gap-8 bg-muted/20">
                  {/* Items */}
                  <div>
                    <p className="label-mono text-muted-foreground text-[9px] mb-3">Items</p>
                    <div className="space-y-3">
                      {(o.items || []).map((/** @type {any} */ it, /** @type {number} */ i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-12 bg-background overflow-hidden shrink-0">
                            {it.image && <Image src={it.image} alt="" className="w-full h-full" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate">{it.name}</p>
                            <p className="label-mono text-muted-foreground text-[9px]">{it.size} · {it.color} · ×{it.quantity}</p>
                          </div>
                          <p className="font-mono text-sm ml-auto">${(it.price * it.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                      {(!o.items || o.items.length === 0) && <p className="text-sm text-muted-foreground">No items recorded.</p>}
                    </div>
                    <div className="mt-4 pt-3 border-t hairline space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">${(o.subtotal || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="font-mono">${(o.shipping_fee || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono">${(o.tax || 0).toFixed(2)}</span></div>
                      {o.discount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span className="font-mono">−${o.discount.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-medium pt-2 border-t hairline"><span>Total</span><span className="font-mono">${(o.total || 0).toFixed(2)}</span></div>
                    </div>
                  </div>

                  {/* Customer */}
                  <div>
                    <p className="label-mono text-muted-foreground text-[9px] mb-3">Customer</p>
                    <p className="text-sm">{o.customer_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1"><Mail size={12} /> {o.email}</p>
                    {o.phone && <p className="text-sm text-muted-foreground mt-1">{o.phone}</p>}
                    {o.shipping_address && (
                      <p className="text-sm text-muted-foreground mt-3 flex items-start gap-2">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span>{o.shipping_address.line1}<br />{o.shipping_address.city}{o.shipping_address.state && `, ${o.shipping_address.state}`} {o.shipping_address.postal_code}<br />{o.shipping_address.country}</span>
                      </p>
                    )}
                    {o.payment_method && <p className="label-mono text-muted-foreground text-[9px] mt-3">Paid via: {o.payment_method}</p>}
                  </div>

                  {/* Status control */}
                  <div>
                    <p className="label-mono text-muted-foreground text-[9px] mb-3">Update Status</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {STATUSES.map((s) => (
                        <button key={s} onClick={() => updateStatus(o.id, s)} className={`px-3 py-2 label-mono text-[9px] capitalize border ${o.status === s ? "bg-foreground text-background border-foreground" : "hairline hover:border-foreground"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No orders found.</p>}
      </div>
    </div>
  );
}