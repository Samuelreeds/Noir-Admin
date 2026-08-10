import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Lock, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";

// Fix for ts(2322): Tell the strict checker that Image accepts any props
/** @type {any} */
const Image = BaseImage;

export default function Checkout() {
  // Fix for ts(2339): cast the context return to 'any'
  const { items, totals, clearCart } = /** @type {any} */ (useCart());
  const navigate = useNavigate();
  const [openStep, setOpenStep] = useState("information");
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    line1: "", city: "", state: "", postal_code: "", country: "United States",
    payment: "card", card: "", expiry: "", cvc: "",
  });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(/** @type {string | null} */ (null));

  const set = (/** @type {string} */ k, /** @type {any} */ v) => setForm((f) => ({ ...f, [k]: v }));

  const steps = [
    { id: "information", label: "Customer Information" },
    { id: "shipping", label: "Shipping Address" },
    { id: "payment", label: "Payment Method" },
  ];

  // Fix for ts(2322): Explicitly cast these string evaluations to strict booleans
  const validInfo = !!(form.name && form.email);
  const validShip = !!(form.line1 && form.city && form.postal_code);
  const validPay = !!(form.payment !== "card" || (form.card && form.expiry && form.cvc));

  const placeOrder = async () => {
    setPlacing(true);
    try {
      // 1. Check if user is logged in to associate the order
      const { data: { session } } = await supabase.auth.getSession();
      
      // 2. Insert main order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: session?.user?.id || null,
          status: 'pending',
          subtotal: totals.subtotal,
          shipping_fee: totals.shippingFee,
          tax: totals.tax,
          grand_total: totals.total,
          payment_method: form.payment,
          shipping_address: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            line1: form.line1,
            city: form.city,
            state: form.state,
            postal_code: form.postal_code,
            country: form.country
          }
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Map cart items to order_items schema
      const orderItems = items.map((/** @type {any} */ i) => ({
        order_id: orderData.id,
        product_id: i.product_id,
        product_name: i.name,
        unit_price: i.price,
        quantity: i.quantity,
        selected_size: i.size,
        selected_color: i.color,
        total_price: i.price * i.quantity
      }));

      // 4. Insert items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      clearCart();
      // Use the last 8 chars of the UUID as a readable order number
      setDone(`MA-${orderData.id.slice(-8).toUpperCase()}`);
    } catch (e) {
      console.error("Checkout error:", e);
      alert("Order could not be placed. Please try again.");
    }
    setPlacing(false);
  };

  if (done) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 border border-foreground rounded-full flex items-center justify-center mb-6">
          <Check size={28} strokeWidth={1.5} />
        </div>
        <p className="label-mono text-muted-foreground mb-3">— Order Confirmed</p>
        <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">Thank you.</h1>
        <p className="text-muted-foreground mt-4">Your order <span className="font-mono text-foreground">{done}</span> has been received.</p>
        <Link to="/shop" className="mt-8 inline-flex items-center gap-2 label-mono border-b border-foreground pb-1">Continue Shopping <ArrowRight size={14} /></Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="font-display text-3xl tracking-[-0.04em]">Your bag is empty.</p>
        <Link to="/shop" className="label-mono border-b border-foreground pb-1">Explore the Collection</Link>
      </div>
    );
  }

  const StepHeader = (/** @type {{ step: any, idx: number, valid: boolean }} */ { step, idx, valid }) => (
    <button
      onClick={() => setOpenStep(step.id)}
      className="w-full flex items-center justify-between py-5"
    >
      <div className="flex items-center gap-4">
        <span className={`w-6 h-6 rounded-full border flex items-center justify-center label-mono text-[10px] ${valid ? "bg-foreground text-background border-foreground" : "hairline"}`}>
          {valid ? <Check size={12} strokeWidth={3} /> : idx + 1}
        </span>
        <span className="font-display text-lg tracking-[-0.04em] uppercase">{step.label}</span>
      </div>
      <ChevronDown size={18} className={`transition-transform ${openStep === step.id ? "rotate-180" : ""}`} />
    </button>
  );

  const inputCls = "w-full border hairline px-4 py-3 outline-none focus:border-foreground font-mono text-sm bg-background";

  return (
    <div className="bg-background">
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
          <Link to="/" className="font-display text-sm tracking-[-0.04em]">MONOLITHIC ATELIER</Link>
          <h1 className="font-display text-4xl md:text-5xl tracking-[-0.04em] mt-4">Checkout.</h1>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 grid lg:grid-cols-[1fr_400px] gap-12">
        {/* Accordion steps */}
        <div>
          {steps.map((step, idx) => {
            const valid = step.id === "information" ? validInfo : step.id === "shipping" ? validShip : validPay;
            return (
              <div key={step.id} className="border-b hairline">
                <StepHeader step={step} idx={idx} valid={valid} />
                {openStep === step.id && (
                  <div className="pb-6 inertia-fade">
                    {step.id === "information" && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <input className={inputCls} placeholder="Full Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
                        <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                        <input className={`${inputCls} sm:col-span-2`} placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                        <button onClick={() => setOpenStep("shipping")} disabled={!validInfo} className="sm:col-span-2 bg-foreground text-background py-3 label-mono disabled:opacity-40">Continue to Shipping</button>
                      </div>
                    )}
                    {step.id === "shipping" && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <input className={`${inputCls} sm:col-span-2`} placeholder="Address" value={form.line1} onChange={(e) => set("line1", e.target.value)} />
                        <input className={inputCls} placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
                        <input className={inputCls} placeholder="State / Province" value={form.state} onChange={(e) => set("state", e.target.value)} />
                        <input className={inputCls} placeholder="Postal Code" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
                        <input className={inputCls} placeholder="Country" value={form.country} onChange={(e) => set("country", e.target.value)} />
                        <button onClick={() => setOpenStep("payment")} disabled={!validShip} className="sm:col-span-2 bg-foreground text-background py-3 label-mono disabled:opacity-40">Continue to Payment</button>
                      </div>
                    )}
                    {step.id === "payment" && (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-3 gap-3">
                          {["card", "paypal", "cod"].map((m) => (
                            <button key={m} onClick={() => set("payment", m)} className={`border py-3 label-mono text-[10px] ${form.payment === m ? "bg-foreground text-background border-foreground" : "hairline"}`}>
                              {m === "card" ? "Credit Card" : m === "paypal" ? "PayPal" : "Cash on Delivery"}
                            </button>
                          ))}
                        </div>
                        {form.payment === "card" && (
                          <div className="grid sm:grid-cols-2 gap-4">
                            <input className={`${inputCls} sm:col-span-2`} placeholder="Card Number" value={form.card} onChange={(e) => set("card", e.target.value)} />
                            <input className={inputCls} placeholder="MM/YY" value={form.expiry} onChange={(e) => set("expiry", e.target.value)} />
                            <input className={inputCls} placeholder="CVC" value={form.cvc} onChange={(e) => set("cvc", e.target.value)} />
                          </div>
                        )}
                        <button onClick={placeOrder} disabled={!validPay || placing} className="w-full bg-foreground text-background py-4 label-mono flex items-center justify-center gap-2 disabled:opacity-40">
                          {placing ? "Placing Order…" : <>Place Order — ${totals.total.toFixed(2)}</>}
                        </button>
                        <p className="flex items-center justify-center gap-2 label-mono text-muted-foreground text-[10px]"><Lock size={11} /> Secure encrypted transaction</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="border hairline p-6">
            <p className="label-mono text-muted-foreground mb-5">— Order Summary</p>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto no-scrollbar">
              {items.map((/** @type {any} */ i) => (
                <div key={i.key} className="flex gap-3">
                  <div className="w-14 h-16 bg-muted shrink-0 overflow-hidden relative">
                    {i.image && <Image src={i.image} alt={i.name} className="w-full h-full" fittingType="fill" />}
                    <span className="absolute -top-1 -right-1 bg-foreground text-background w-4 h-4 rounded-full flex items-center justify-center font-mono text-[9px]">{i.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{i.name}</p>
                    <p className="label-mono text-muted-foreground text-[10px] mt-0.5">{i.color} · {i.size}</p>
                  </div>
                  <span className="font-mono text-sm">${(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t hairline mt-5 pt-5 space-y-2.5">
              <div className="flex justify-between label-mono text-muted-foreground"><span>Subtotal</span><span className="font-mono text-foreground">${totals.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between label-mono text-muted-foreground"><span>Shipping</span><span className="font-mono text-foreground">{totals.shippingFee === 0 ? "Free" : `$${totals.shippingFee.toFixed(2)}`}</span></div>
              <div className="flex justify-between label-mono text-muted-foreground"><span>Tax</span><span className="font-mono text-foreground">${totals.tax.toFixed(2)}</span></div>
              <div className="flex justify-between pt-3 border-t hairline">
                <span className="font-display uppercase">Total</span>
                <span className="font-mono text-xl">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}