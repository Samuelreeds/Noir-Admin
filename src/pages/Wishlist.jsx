import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/cart-context";
import ProductCard from "@/components/store/ProductCard";
import Reveal from "@/components/store/Reveal";

export default function Wishlist() {
  const { wishlist } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (wishlist.length === 0) { setProducts([]); setLoading(false); return; }
      try {
        const all = await base44.entities.Product.list("-created_date", 200);
        setProducts(all.filter((p) => wishlist.includes(p.id)));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [wishlist]);

  return (
    <div className="bg-background">
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-14">
          <p className="label-mono text-muted-foreground mb-3">— Saved</p>
          <h1 className="font-display text-5xl md:text-7xl tracking-[-0.05em]">Wishlist.</h1>
          <p className="text-muted-foreground mt-3 text-sm">{products.length} object{products.length !== 1 ? "s" : ""} saved</p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
        {loading ? (
          <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin mx-auto" />
        ) : products.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center gap-4">
            <Heart size={32} strokeWidth={1} className="text-muted-foreground" />
            <p className="font-display text-3xl tracking-[-0.04em]">No saved objects.</p>
            <p className="text-muted-foreground text-sm">Tap the heart on any garment to save it here.</p>
            <Link to="/shop" className="label-mono border-b border-foreground pb-1 mt-2">Explore the Collection</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 60}>
                <ProductCard product={p} index={i} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}