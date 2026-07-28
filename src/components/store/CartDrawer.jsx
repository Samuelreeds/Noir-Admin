import React from "react";
import { Link } from "react-router-dom";
import { X, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Image } from "@/components/ui/image";

export default function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeItem, updateQty, totals } = useCart();

  return (
    <div className={`fixed inset-0 z-[80] ${drawerOpen ? "" : "pointer-events-none"}`}>
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-500 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        onClick={closeDrawer}
      />
      {/* panel */}
      <aside
        className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-background flex flex-col transition-transform duration-500 cubic-bezier(0.16,1,0.3,1) ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b hairline">
          <span className="font-display text-sm tracking-[-0.04em] uppercase">Your Bag ({totals.itemCount})</span>
          <button onClick={closeDrawer} aria-label="Close cart"><X size={18} strokeWidth={1.5} /></button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
            <p className="font-display text-2xl tracking-[-0.04em]">Your bag is empty.</p>
            <p className="text-muted-foreground text-sm">No objects selected. Begin your collection.</p>
            <Link to="/shop" onClick={closeDrawer} className="label-mono border-b border-foreground pb-1 hover:opacity-60 transition-opacity">
              Explore the Collection
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              {items.map((item) => (
                <div key={item.key} className="flex gap-4 py-5 border-b hairline">
                  <div className="w-20 h-24 bg-muted shrink-0 overflow-hidden">
                    {item.image && <Image src={item.image} alt={item.name} className="w-full h-full" fittingType="fill" />}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between gap-2">
                      <h3 className="text-sm font-medium leading-snug">{item.name}</h3>
                      <button onClick={() => removeItem(item.key)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Remove">
                        <X size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="label-mono text-muted-foreground mt-1">
                      {item.color} · {item.size}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center border hairline">
                        <button onClick={() => updateQty(item.key, item.quantity - 1)} className="px-2 py-1 hover:bg-muted" aria-label="Decrease"><Minus size={12} /></button>
                        <span className="px-3 font-mono text-xs">{item.quantity}</span>
                        <button onClick={() => updateQty(item.key, item.quantity + 1)} className="px-2 py-1 hover:bg-muted" aria-label="Increase"><Plus size={12} /></button>
                      </div>
                      <span className="font-mono text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t hairline px-6 py-5 space-y-3">
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>Subtotal</span><span className="font-mono text-foreground">${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>Shipping</span><span className="font-mono text-foreground">{totals.shippingFee === 0 ? "Complimentary" : `$${totals.shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>Tax (est.)</span><span className="font-mono text-foreground">${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t hairline">
                <span className="font-display text-sm uppercase">Total</span>
                <span className="font-mono text-lg">${totals.total.toFixed(2)}</span>
              </div>
              <Link
                to="/checkout"
                onClick={closeDrawer}
                className="w-full mt-2 bg-foreground text-background flex items-center justify-center gap-2 py-4 label-mono hover:bg-foreground/85 transition-colors"
              >
                Proceed to Checkout <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}