import React, { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";

/** @type {any} */
const Image = BaseImage;

const STATUSES = ["pending", "processing", "shipped", "delivered"];

export default function AccountOrders() {
  const { user } = /** @type {any} */ (useOutletContext());
  const [orders, setOrders] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        // Removed the strict products() join to prevent FK failures from dropping the order items
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedOrders = (data || []).map((/** @type {any} */ o) => ({
          ...o,
          total: Number(o.grand_total) || 0,
          items: o.order_items?.map((/** @type {any} */ i) => ({
            name: i.product_name,
            image: i.product_image || '', // Fallback if image isn't saved directly in order_items
            size: i.selected_size,
            color: i.selected_color,
            quantity: i.quantity,
            price: Number(i.unit_price)
          })) || []
        }));

        setOrders(mappedOrders);
      } catch (e) { 
        console.error("Failed to load orders:", e); 
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="py-16 flex justify-center"><div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl tracking-[-0.04em]">Order History</h2>

      {orders.length === 0 ? (
        <div className="border hairline p-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">You have no orders yet.</p>
          <Link to="/shop" className="label-mono border-b border-foreground pb-1">Explore the Collection</Link>
        </div>
      ) : (
        <div className="border hairline divide-y hairline">
          {orders.map((/** @type {any} */ o) => {
            const open = expanded === o.id;
            const currentStepIndex = STATUSES.indexOf((o.status || "pending").toLowerCase());

            return (
              <div key={o.id}>
                <button onClick={() => setExpanded(open ? null : o.id)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/40 text-left">
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                  <div className="min-w-0">
                    <p className="label-mono text-[10px]">{o.order_number || String(o.id).slice(-8).toUpperCase()}</p>
                    <p className="label-mono text-muted-foreground text-[9px] mt-0.5">{new Date(o.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                  </div>
                  <span className={`label-mono text-[9px] px-2 py-1 uppercase ${o.status === "delivered" || o.status === "paid" ? "bg-foreground text-background" : "bg-muted"}`}>{o.status}</span>
                  <p className="font-mono text-sm ml-auto">${(o.total || 0).toFixed(2)}</p>
                </button>
                
                {open && (
                  <div className="px-5 pb-8 pt-6 bg-muted/20">
                    
                    {/* Step-by-Step Order Tracker */}
                    <div className="flex w-full mb-10">
                      {STATUSES.map((step, idx) => {
                        const isCompleted = idx <= currentStepIndex;
                        return (
                          <div key={step} className="flex-1 flex flex-col items-center relative">
                            <div className="w-full flex items-center relative">
                              <div className={`h-[1px] flex-1 ${idx === 0 ? "bg-transparent" : (isCompleted ? "bg-foreground" : "bg-muted-foreground/30")}`} />
                              
                              <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors relative z-10 ${isCompleted ? "border-foreground bg-foreground text-background" : "border-muted-foreground/30 bg-background"}`}>
                                {isCompleted && <Check size={12} strokeWidth={3} />}
                              </div>
                              
                              <div className={`h-[1px] flex-1 ${idx === STATUSES.length - 1 ? "bg-transparent" : (idx < currentStepIndex ? "bg-foreground" : "bg-muted-foreground/30")}`} />
                            </div>
                            <span className={`absolute top-8 label-mono text-[9px] uppercase text-center ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                              {step}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    <p className="label-mono text-muted-foreground text-[9px] mb-3 uppercase">Order Items</p>
                    <div className="space-y-3">
                      {(o.items || []).map((/** @type {any} */ it, /** @type {number} */ i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-12 bg-background overflow-hidden shrink-0 border hairline flex items-center justify-center">
                            {it.image ? (
                              <Image src={it.image} alt={it.name} className="w-full h-full" fittingType="fill" />
                            ) : (
                              <span className="font-display text-muted-foreground text-xs">{it.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{it.name}</p>
                            <p className="label-mono text-muted-foreground text-[9px]">{it.size} · {it.color} · ×{it.quantity}</p>
                          </div>
                          <p className="font-mono text-sm">${(it.price * it.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>

                    {o.shipping_address && (
                      <div className="mt-6 pt-5 border-t hairline">
                        <p className="label-mono text-muted-foreground text-[9px] mb-2 uppercase">Shipped to</p>
                        <p className="text-sm font-mono text-foreground">
                          {o.shipping_address.name} 
                          <span className="text-muted-foreground ml-2">({o.shipping_address.phone})</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{o.shipping_address.address}</p>
                        <p className="text-sm text-muted-foreground">{o.shipping_address.province}</p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}