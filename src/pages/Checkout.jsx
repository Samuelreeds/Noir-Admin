import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Lock, ArrowRight, Smartphone, Clock, UploadCloud } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";

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
  
  const [form, setForm] = useState({
    name: "", phone: "",
    address: "", province: "",
    transactionImage: /** @type {File | null} */ (null),
  });
  
  const [placing, setPlacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(/** @type {string | null} */ (null));
  const [createdOrder, setCreatedOrder] = useState(/** @type {any} */ (null));
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCartExpiredModal, setShowCartExpiredModal] = useState(false);
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showQRPopup, setShowQRPopup] = useState(false);

  const [storeSettings, setStoreSettings] = useState({
    shipping_pp_price: 1.50,
    shipping_province_price: 2.50,
    enable_tax: false,
    tax_rate: 0
  });

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
        name: user.full_name || f.name,
        phone: user.phone || f.phone
      }));
    }
  }, [user]);

  const set = (/** @type {string} */ k, /** @type {any} */ v) => setForm((f) => ({ ...f, [k]: v }));

  const validDelivery = !!(form.name && form.phone && form.address && form.province);
  const validPayment = !!form.transactionImage;

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

  // STEP 1: Create Order in Database first
  const handlePlaceOrderClick = async () => {
    if (cartExpiresAt && Date.now() > parseInt(cartExpiresAt, 10)) {
      setShowCartExpiredModal(true); return; 
    }
    if (!user) {
      setShowAuthModal(true); return;
    }

    setPlacing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: session?.user?.id || null,
          status: 'pending',
          subtotal: totals.subtotal,
          shipping_fee: activeShippingFee, 
          tax: activeTaxAmount,
          grand_total: activeTotal,
          payment_method: 'qr',
          shipping_address: {
            name: form.name,
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

      setCreatedOrder(orderData);
      setShowQRPopup(true);
    } catch (/** @type {any} */ e) {
      console.error("Order Creation Error:", e);
      alert(e.message || "Order could not be initialized. Please try again.");
    }
    setPlacing(false);
  };

  // STEP 2: Upload Receipt & Complete Order
  const submitPaymentReceipt = async () => {
    if (!createdOrder || !form.transactionImage) return;
    setUploading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const fileExt = form.transactionImage.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${session?.user?.id || 'guest'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, form.transactionImage);

      if (uploadError) throw new Error("Failed to upload receipt image.");

      const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
      
      // Update order with the screenshot URL for your Telegram bot to use
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          transaction_receipt_url: publicUrlData.publicUrl
        })
        .eq('id', createdOrder.id);

      if (updateError) throw updateError;

      setShowQRPopup(false);
      clearCart();
      setDone(`MA-${createdOrder.id.slice(-8).toUpperCase()}`);
    } catch (/** @type {any} */ e) {
      console.error("Payment Submission Error:", e);
      alert(e.message || "Payment could not be submitted. Please try again.");
    }
    setUploading(false);
  };

  // --- SUCCESS UI ---
  if (done) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 bg-background">
        <div className="max-w-md w-full border hairline p-8 md:p-12 text-center relative overflow-hidden bg-white shadow-sm">
          {/* Subtle top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-foreground"></div>
          
          <div className="w-16 h-16 border hairline bg-background rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
            <Check size={24} strokeWidth={1.5} className="text-foreground" />
          </div>
          
          <h1 className="font-display text-4xl tracking-tight mb-2">Thank You.</h1>
          <p className="label-mono text-[10px] text-muted-foreground mb-8 tracking-widest uppercase">Order Confirmed</p>
          
          <div className="py-6 border-y hairline mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">Your order reference is</p>
            <p className="font-mono text-xl md:text-2xl text-foreground font-medium tracking-tight bg-muted/30 py-3 rounded-sm">{done}</p>
          </div>
          
          <div className="bg-muted/10 border hairline p-5 mb-8 text-left relative overflow-hidden flex items-start gap-4">
            <div className="absolute left-0 top-0 h-full w-1 bg-amber-500/80"></div>
            <Clock className="text-amber-600 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-mono text-xs text-foreground uppercase font-semibold tracking-wider mb-1.5">Payment Verification Pending</p>
              <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">Our team will verify your KHQR transfer shortly before processing your delivery. You will receive an update once confirmed.</p>
            </div>
          </div>

          <Link to="/shop" className="inline-flex items-center justify-center gap-2 w-full bg-foreground text-background py-4 label-mono transition-opacity hover:opacity-90">
            Continue Shopping <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !showQRPopup) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="font-display text-3xl tracking-[-0.04em]">Your bag is empty.</p>
        <Link to="/shop" className="label-mono border-b border-foreground pb-1">Explore the Collection</Link>
      </div>
    );
  }

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
        
        {/* Delivery Details Form */}
        <div>
          <div className="border hairline">
            <div className="w-full flex items-center gap-4 px-6 py-5 border-b hairline bg-muted/10">
              <span className="font-display text-lg tracking-[-0.04em] uppercase">Delivery Details</span>
            </div>
            
            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <input className={inputCls} placeholder="Full Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
                <input className={inputCls} type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                <input className={`${inputCls} sm:col-span-2`} placeholder="Full Address (Street, House No.)" value={form.address} onChange={(e) => set("address", e.target.value)} />
                
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
                      onBlur={() => setTimeout(() => setShowProvinceDropdown(false), 200)}
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
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button onClick={handlePlaceOrderClick} disabled={!validDelivery || placing} className="w-full bg-foreground text-background py-5 mt-6 label-mono flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90">
            {placing ? "Processing..." : <>Confirm Details & Pay — ${activeTotal.toFixed(2)}</>}
          </button>
          <p className="flex items-center justify-center gap-2 mt-4 label-mono text-muted-foreground text-[10px]"><Lock size={11} /> Secure encrypted checkout</p>
        </div>

        {/* Order summary sidebar */}
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

      {/* --- TELEGRAM AUTH MODAL --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-background border hairline max-w-md w-full p-8 shadow-2xl inertia-fade text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Smartphone size={32} />
            </div>
            <h3 className="font-display text-2xl tracking-[-0.04em] mb-2">Sign In Required</h3>
            <p className="text-muted-foreground mb-8 font-mono text-sm px-4">
              Please sign in with your Telegram account to securely track and complete your order.
            </p>
            <div className="space-y-3">
              <button onClick={() => alert("Telegram Login Integration Coming Soon!")} className="w-full py-3.5 bg-[#229ED9] text-white label-mono transition-opacity hover:opacity-90 flex justify-center items-center gap-2">
                Sign in with Telegram
              </button>
              <button onClick={() => setShowAuthModal(false)} className="w-full py-3.5 border hairline label-mono hover:bg-muted/50 transition-colors text-muted-foreground">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- QR PAYMENT POPUP WITH FILE UPLOAD --- */}
      {showQRPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm overflow-y-auto">
          <div className="bg-background border hairline max-w-sm w-full p-6 shadow-2xl inertia-fade relative my-8">
            <div className="text-center mb-6">
              <h3 className="font-display text-2xl tracking-[-0.04em] uppercase">Complete Payment</h3>
              <p className="text-muted-foreground font-mono text-xs mt-2">Order <span className="text-foreground">MA-{createdOrder?.id?.slice(-8).toUpperCase()}</span> saved successfully.</p>
            </div>

            <div className="border hairline bg-muted/10 p-6 flex flex-col items-center mb-6">
              <p className="font-mono text-sm text-foreground mb-4 uppercase tracking-wider font-semibold">Total: ${activeTotal.toFixed(2)}</p>
              <div className="w-48 h-48 bg-white p-2 border hairline mb-4">
                {/* Static Placeholder QR Code */}
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MONOLITHIC_ATELIER_KHQR_PLACEHOLDER" 
                  alt="Company KHQR" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <p className="label-mono text-muted-foreground text-[10px] text-center">Scan with any Cambodia banking app (KHQR) to transfer.</p>
            </div>

            {/* Added Screenshot Upload Field */}
            <div className="space-y-2 mb-6">
              <label className="label-mono text-muted-foreground text-[10px] uppercase">Upload Payment Screenshot</label>
              <div className="relative">
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => set("transactionImage", e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`w-full border hairline px-4 py-3 font-mono text-sm flex items-center justify-between transition-colors ${form.transactionImage ? 'bg-muted/30 text-foreground' : 'bg-background text-muted-foreground'}`}>
                  <span className="truncate">{form.transactionImage ? form.transactionImage.name : "Select image file..."}</span>
                  <UploadCloud size={16} className="shrink-0 ml-2" />
                </div>
              </div>
            </div>

            <button 
              onClick={submitPaymentReceipt} 
              disabled={!validPayment || uploading} 
              className="w-full bg-foreground text-background py-4 mt-2 label-mono flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
            >
              {uploading ? "Submitting..." : "I Have Paid — Complete Order"}
            </button>
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