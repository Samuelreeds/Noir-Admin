import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Heart, Minus, Plus, ShoppingBag, ChevronRight, Truck, RotateCcw, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { useCart } from "@/lib/cart-context";
import ProductCard from "@/components/store/ProductCard";
import Reveal from "@/components/store/Reveal";

// Generate a Code-128-style barcode visual from the barcode string
function BarcodeSVG({ value }) {
  if (!value) return null;
  const bars = [];
  let x = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const width = (code % 3) + 1;
    bars.push(<rect key={i} x={x} y={0} width={width} height={50} fill="#050505" />);
    x += width + (code % 2);
  }
  return (
    <svg width={x} height="50" viewBox={`0 0 ${x} 50`} className="block">
      {bars}
    </svg>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, toggleWishlist, isInWishlist, openDrawer } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [showBarcode, setShowBarcode] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setActiveImg(0); setSize(null); setColor(null); setQty(1);
    (async () => {
      try {
        const p = await base44.entities.Product.get(id);
        setProduct(p);
        if (p.colors?.length) setColor(p.colors[0]);
        if (p.sizes?.length) setSize(p.sizes[0]);
        const all = await base44.entities.Product.list("-created_date", 60);
        setRelated(all.filter((x) => x.id !== p.id && (x.gender === p.gender || x.category_id === p.category_id)).slice(0, 4));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="font-display text-3xl tracking-[-0.04em]">Object not found.</p>
        <Link to="/shop" className="label-mono border-b border-foreground pb-1">Return to Shop</Link>
      </div>
    );
  }

  const hasDiscount = product.discount_price != null && product.discount_price < product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0;
  const currentPrice = hasDiscount ? product.discount_price : product.price;
  const liked = isInWishlist(product.id);
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const images = product.images?.length ? product.images : [];

  const handleAdd = () => {
    addItem(product, { size: size || "ONE SIZE", color: color || "Default", quantity: qty });
  };
  const handleBuyNow = () => {
    handleAdd();
    navigate("/checkout");
  };

  return (
    <div className="bg-background">
      {/* Breadcrumb */}
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center gap-2 label-mono text-muted-foreground text-[10px]">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight size={11} />
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <ChevronRight size={11} />
          <span className="text-foreground truncate">{product.name}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 grid md:grid-cols-[60%_40%] gap-0 md:gap-10 py-8 md:py-12">
        {/* Image stack — sticky on desktop */}
        <div className="flex flex-col-reverse md:flex-row gap-4 md:sticky md:top-24 md:self-start md:max-h-[calc(100vh-7rem)] md:overflow-y-auto no-scrollbar">
          {images.length > 1 && (
            <div className="flex md:flex-col gap-3 md:max-h-[60vh] md:overflow-y-auto no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 md:w-20 aspect-[4/5] shrink-0 overflow-hidden border ${activeImg === i ? "border-foreground" : "hairline"}`}
                >
                  <Image src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full" fittingType="fill" />
                </button>
              ))}
            </div>
          )}
          <div className="flex-1">
            <div className="aspect-[4/5] bg-muted overflow-hidden">
              {images[activeImg] && <Image src={images[activeImg]} alt={product.name} className="w-full h-full" fittingType="fill" />}
            </div>
          </div>
        </div>

        {/* Data panel */}
        <div className="md:py-2">
          <div className="flex items-center gap-2 mb-3">
            {product.is_new && <span className="label-mono border hairline px-2 py-1">New</span>}
            {product.is_best_seller && <span className="label-mono border hairline px-2 py-1">Best Seller</span>}
            {hasDiscount && <span className="label-mono bg-foreground text-background px-2 py-1">−{discountPct}%</span>}
          </div>

          <h1 className="font-display text-3xl md:text-5xl tracking-[-0.04em] leading-[0.95]">{product.name}</h1>

          {/* SKU + barcode reveal */}
          <div
            className="mt-4 min-h-[28px] cursor-pointer"
            onMouseEnter={() => setShowBarcode(true)}
            onMouseLeave={() => setShowBarcode(false)}
            onClick={() => setShowBarcode((s) => !s)}
          >
            {!showBarcode ? (
              <p className="label-mono text-muted-foreground">SKU: {product.sku || "—"}</p>
            ) : (
              <div className="transition-all duration-300">
                <BarcodeSVG value={product.barcode || product.sku || "000000000000"} />
                <p className="label-mono text-muted-foreground mt-1">{product.barcode || "No barcode"}</p>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mt-6">
            <span className="font-mono text-3xl tracking-tight">${currentPrice.toFixed(2)}</span>
            {hasDiscount && <span className="font-mono text-lg text-muted-foreground line-through">${product.price.toFixed(2)}</span>}
          </div>
          {hasDiscount && <p className="label-mono text-destructive mt-1">You save ${((product.price - currentPrice)).toFixed(2)} ({discountPct}%)</p>}

          {/* Availability */}
          <div className="mt-4 flex items-center gap-2 label-mono">
            <span className={`w-2 h-2 rounded-full ${soldOut ? "bg-destructive" : lowStock ? "bg-amber-500" : "bg-emerald-500"}`} />
            <span className={soldOut ? "text-destructive" : "text-muted-foreground"}>
              {soldOut ? "Sold Out" : lowStock ? `Low Stock — ${product.stock} left` : `In Stock — ${product.stock} units`}
            </span>
          </div>

          {/* Description */}
          <div className="mt-6 border-t hairline pt-6">
            <button onClick={() => setDescOpen((o) => !o)} className="flex items-center justify-between w-full label-mono">
              <span>Description</span><Plus size={14} className={`transition-transform ${descOpen ? "rotate-45" : ""}`} />
            </button>
            {descOpen && product.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-4 inertia-fade">{product.description}</p>
            )}
            {!product.description && descOpen && <p className="text-sm text-muted-foreground mt-4">No description available.</p>}
          </div>

          {/* Color */}
          {product.colors?.length > 0 && (
            <div className="mt-6">
              <p className="label-mono text-muted-foreground mb-3">Color — <span className="text-foreground">{color}</span></p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`px-4 py-2 border label-mono text-[10px] ${color === c ? "bg-foreground text-background border-foreground" : "hairline"}`}
                  >{c}</button>
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          {product.sizes?.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="label-mono text-muted-foreground">Size</p>
                <button className="label-mono text-muted-foreground underline underline-offset-4 text-[10px]">Size Guide</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-[3rem] px-3 py-2.5 border label-mono text-[10px] ${size === s ? "bg-foreground text-background border-foreground" : "hairline hover:border-foreground"}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-6">
            <p className="label-mono text-muted-foreground mb-3">Quantity</p>
            <div className="inline-flex items-center border hairline">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 hover:bg-muted" aria-label="Decrease"><Minus size={14} /></button>
              <span className="px-6 font-mono text-sm">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-3 hover:bg-muted" aria-label="Increase"><Plus size={14} /></button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <button
              onClick={handleAdd}
              disabled={soldOut}
              className="w-full bg-foreground text-background py-4 label-mono flex items-center justify-center gap-2 hover:bg-foreground/85 transition-colors disabled:opacity-40"
            >
              <ShoppingBag size={15} /> Add to Bag
            </button>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button
                onClick={handleBuyNow}
                disabled={soldOut}
                className="border border-foreground py-4 label-mono hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
              >
                Buy Now
              </button>
              <button
                onClick={() => toggleWishlist(product.id)}
                aria-label="Wishlist"
                className="border hairline px-5 flex items-center justify-center hover:border-foreground transition-colors"
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          {/* Technical specs */}
          <div className="mt-8 border-t hairline pt-6 grid grid-cols-2 gap-y-4 gap-x-6">
            {[
              ["Material", product.material],
              ["Brand", product.brand_name || "Monolithic"],
              ["Gender", product.gender],
              ["Category", product.category_name || "—"],
              ["Barcode", product.barcode || "—"],
              ["SKU", product.sku || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="label-mono text-muted-foreground text-[10px]">{k}</p>
                <p className="text-sm font-mono mt-1 capitalize">{v || "—"}</p>
              </div>
            ))}
          </div>

          {/* Assurances */}
          <div className="mt-8 space-y-3 border-t hairline pt-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><Truck size={16} /> Complimentary global shipping over $250</div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><RotateCcw size={16} /> 30-day returns on unworn garments</div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><Shield size={16} /> Authenticated & quality assured</div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t hairline py-16 md:py-24">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <Reveal className="mb-10">
              <p className="label-mono text-muted-foreground mb-3">— Continue</p>
              <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">You May Also Covet.</h2>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {related.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 70}>
                  <ProductCard product={p} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}