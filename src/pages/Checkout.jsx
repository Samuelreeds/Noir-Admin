import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Lock, ArrowRight, QrCode } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";

// Fix for ts(2322): Tell the strict checker that Image accepts any props
/** @type {any} */
const Image = BaseImage;

const CAMBODIA_PROVINCES = [
  "Banteay Meanchey", "Battambang", "Kampong Cham", "Kampong Chhnang",
  "Kampong Speu", "Kampong Thom", "Kampot", "Kandal", "Kep",
  "Koh Kong", "Kratie", "Mondulkiri", "Oddar Meanchey", "Pailin",
  "Phnom Penh", "Preah Sihanouk", "Preah Vihear", "Prey Veng",
  "Pursat", "Ratanakiri", "Siem Reap", "Stung Treng", "Svay Rieng",
  "Takeo", "Tboung Khmum"
];

export default function Checkout() {
  const { items, totals, clearCart, cartExpiresAt } = /** @type {any} */ (useCart());
  const { user } = /** @type {any} */ (useAuth());
  const navigate = useNavigate();
  
  const [openStep, setOpenStep] = useState("information");
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", province: "",
    payment: "qr", 
    transactionId: "", 
    transactionImage: /** @type {File | null} */ (null),
  });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(/** @type {string | null} */ (null));
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCartExpiredModal, setShowCartExpiredModal] = useState(false);
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);

  // --- NEW: Admin Settings State ---
  const [storeSettings, setStoreSettings] = useState({
    shipping_pp_price: 1.50,
    shipping_province_price: 2.50,
    enable_tax: false,
    tax_rate: 0
  });

  // Fetch dynamic store settings on mount
  useEffect(() => {
    supabase.from('store_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        setStoreSettings({
          shipping_pp_price: data.shipping_pp_price ?? 1.50,
          shipping_province_price: data.shipping_province_price ?? 2.50,
          enable_tax: !!data.enable_tax,
          tax_rate: data.tax_rate ?? 0
        });
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        name: user.full_name || user.email?.split('@')[0] || f.name,
        email: user.email || f.email,
        phone: user.phone || f.phone
      }));
      
      if (user.email && user.phone) {
        setOpenStep("shipping");
      }
    }
  }, [user]);

  const set = (/** @type {string} */ k, /** @type {any} */ v) => setForm((f) => ({ ...f, [k]: v }));

  const steps = [
    { id: "information", label: "Customer Information" },
    { id: "shipping", label: "Shipping Address" },
    { id: "payment", label: "Payment Method" },
  ];

  const validInfo = !!(form.name && form.email && form.phone);
  const validShip = !!(form.address && form.province);
  const validPay = form.payment === "cod" || (form.payment === "qr" && form.transactionId.trim() !== "" && form.transactionImage !== null); 

  // --- DYNAMIC CALCULATIONS ---
  const activeShippingFee = form.province 
    ? (form.province.trim().toLowerCase() === "phnom penh" 
        ? storeSettings.shipping_pp_price 
        : storeSettings.shipping_province_price) 
    : 0; 
  
  const activeTaxAmount = storeSettings.enable_tax 
    ? (totals.subtotal * (storeSettings.tax_rate / 100))
    : 0;

  const activeTotal = totals.subtotal + activeShippingFee + activeTaxAmount;

  const handleCartExpiredAcknowledge = () => {
    setShowCartExpiredModal(false); 
    clearCart(); 
    navigate("/shop"); 
  };

  const placeOrder = async () => {
    if (cartExpiresAt && Date.now() > parseInt(cartExpiresAt, 10)) {
      setShowCartExpiredModal(true); 
      return; 
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setPlacing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let receiptUrl = null;

      if (form.payment === "qr" && form.transactionImage) {
        const fileExt = form.transactionImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${session?.user?.id || 'guest'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, form.transactionImage);

        if (uploadError) throw new Error("Failed to upload receipt image. Please try again.");

        const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
        receiptUrl = publicUrlData.publicUrl;
      }
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: session?.user?.id || null,
          status: 'pending',
          subtotal: totals.subtotal,
          shipping_fee: activeShippingFee, 
          tax: activeTaxAmount, // Use dynamic tax
          grand_total: activeTotal, // Use dynamic total
          payment_method: form.payment,
          transaction_reference: form.payment === "qr" ? form.transactionId : null,
          transaction_receipt_url: receiptUrl,
          shipping_address: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            address: form.address,
            province: form.province
          }
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((/** @type {any} */ i) => ({
        order_id: orderData.id,
        product_id: i.product_id || i.id,
        product_name: i.name,
        unit_price: i.price,
        quantity: i.quantity,
        selected_size: i.size,
        selected_color: i.color,
        total_price: i.price * i.quantity
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      clearCart();
      setDone(`MA-${orderData.id.slice(-8).toUpperCase()}`);
    } catch (e) {
      console.error("Checkout error:", e);
      alert(e.message || "Order could not be placed. Please try again.");
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
        
        {form.payment === "qr" && (
          <div className="mt-6 p-4 border hairline bg-muted/20 max-w-sm mx-auto">
             <p className="font-mono text-sm mb-2 text-foreground">We have received your transaction receipt.</p>
             <p className="text-[11px] text-muted-foreground mt-1 font-mono">Our team will verify the payment shortly.</p>
          </div>
        )}

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
    <div className="bg-background relative">
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
          <Link to="/" className="font-display text-sm tracking-[-0.04em]">NOIR MTD</Link>
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
                        <input className={`${inputCls} sm:col-span-2`} type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                        <button onClick={() => setOpenStep("shipping")} disabled={!validInfo} className="sm:col-span-2 bg-foreground text-background py-3 label-mono disabled:opacity-40">Continue to Shipping</button>
                      </div>
                    )}
                    {step.id === "shipping" && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <input className={`${inputCls} sm:col-span-2`} placeholder="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
                        
                        <div className="relative sm:col-span-2">
                          <div className="relative flex items-center">
                            <input 
                              className={inputCls} 
                              placeholder="Search or Select Province" 
                              value={form.province} 
                              onChange={(e) => {
                                set("province", e.target.value);
                                setShowProvinceDropdown(true);
                              }}
                              onFocus={() => setShowProvinceDropdown(true)}
                              onBlur={() => setShowProvinceDropdown(false)}
                            />
                            <ChevronDown size={16} className="absolute right-4 text-muted-foreground pointer-events-none" />
                          </div>
                          
                          {showProvinceDropdown && (
                            <div 
                              className="absolute top-full left-0 w-full bg-background border hairline max-h-48 overflow-y-auto z-20 shadow-xl mt-1 inertia-fade"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {CAMBODIA_PROVINCES.filter(p => p.toLowerCase().includes(form.province.toLowerCase())).map(p => (
                                <div
                                  key={p}
                                  className="px-4 py-3 font-mono text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    set("province", p);
                                    setShowProvinceDropdown(false);
                                  }}
                                >
                                  {p}
                                </div>
                              ))}
                              {CAMBODIA_PROVINCES.filter(p => p.toLowerCase().includes(form.province.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 font-mono text-sm text-muted-foreground">No matching province found.</div>
                              )}
                            </div>
                          )}
                        </div>

                        <button onClick={() => setOpenStep("payment")} disabled={!validShip} className="sm:col-span-2 bg-foreground text-background py-3 label-mono disabled:opacity-40">Continue to Payment</button>
                      </div>
                    )}
                    {step.id === "payment" && (
                      <div className="space-y-4">
                        
                        <div className="grid sm:grid-cols-2 gap-4">
                          {["qr", "cod"].map((m) => (
                            <button key={m} onClick={() => set("payment", m)} className={`border py-4 label-mono text-[11px] flex flex-col items-center gap-2 ${form.payment === m ? "bg-foreground text-background border-foreground" : "hairline hover:bg-muted/50"}`}>
                              {m === "qr" ? "Bank / QR Transfer" : "Cash on Delivery"}
                            </button>
                          ))}
                        </div>

                        {form.payment === "qr" && (
                          <div className="p-6 border hairline bg-muted/10 flex flex-col items-center space-y-5 text-center inertia-fade">
                             <p className="font-mono text-sm text-foreground">Scan to Pay (KHQR)</p>
                             
                             <div className="w-48 h-48 bg-white p-2 border hairline">
                               <img 
                                 src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MONOLITHIC_ATELIER_KHQR_PLACEHOLDER" 
                                 alt="Company KHQR" 
                                 className="w-full h-full object-contain" 
                               />
                             </div>
                             
                             <div className="w-full space-y-4 text-left pt-2">
                               <div className="space-y-2">
                                 <label className="label-mono text-muted-foreground text-[10px]">1. Submit Transaction ID / Reference</label>
                                 <input 
                                   className={inputCls} 
                                   placeholder="e.g., 1234567890" 
                                   value={form.transactionId} 
                                   onChange={(e) => set("transactionId", e.target.value)} 
                                 />
                               </div>
                               
                               <div className="space-y-2">
                                 <label className="label-mono text-muted-foreground text-[10px]">2. Upload Payment Screenshot</label>
                                 <input 
                                   type="file"
                                   accept="image/*"
                                   className="w-full border hairline px-3 py-2 outline-none focus:border-foreground font-mono text-[13px] bg-background text-muted-foreground file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-foreground file:text-background file:font-mono file:text-[11px] file:uppercase file:cursor-pointer hover:file:opacity-90"
                                   onChange={(e) => set("transactionImage", e.target.files?.[0] || null)}
                                 />
                               </div>
                             </div>
                          </div>
                        )}

                        <button onClick={placeOrder} disabled={!validPay || placing} className="w-full bg-foreground text-background py-4 label-mono flex items-center justify-center gap-2 disabled:opacity-40 mt-4">
                          {placing ? "Placing Order…" : <>Place Order — ${activeTotal.toFixed(2)}</>}
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
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono text-foreground">${totals.subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>Shipping</span>
                <span className="font-mono text-foreground">${activeShippingFee.toFixed(2)}</span>
              </div>
              
              {/* CONDITIONAL TAX: Only displays if enabled in Web Setup */}
              {storeSettings.enable_tax && (
                <div className="flex justify-between label-mono text-muted-foreground">
                  <span>Tax ({storeSettings.tax_rate}%)</span>
                  <span className="font-mono text-foreground">${activeTaxAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between pt-3 border-t hairline">
                <span className="font-display uppercase">Total</span>
                <span className="font-mono text-xl">${activeTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-background border hairline max-w-md w-full p-6 shadow-2xl inertia-fade">
            <h3 className="font-display text-2xl tracking-[-0.04em] mb-2">Sign In Required</h3>
            <p className="text-muted-foreground mb-6 font-mono text-sm">
              Please sign in to your account or create a new one to securely complete your order.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowAuthModal(false)} className="flex-1 py-3 border hairline label-mono hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={() => navigate('/login')} className="flex-1 py-3 bg-foreground text-background label-mono transition-opacity hover:opacity-90">Sign In</button>
            </div>
          </div>
        </div>
      )}

      {showCartExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-background border hairline max-w-md w-full p-6 shadow-2xl inertia-fade relative z-[60]">
            <h3 className="font-display text-2xl tracking-[-0.04em] mb-2">Cart Reservation Expired</h3>
            <p className="text-muted-foreground mb-6 font-mono text-sm">
              Your cart reservation has expired after 10 minutes. Please add the items again.
            </p>
            <div className="flex gap-4">
              <button onClick={handleCartExpiredAcknowledge} className="w-full py-3 bg-foreground text-background label-mono transition-opacity hover:opacity-90">Return to Shop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}