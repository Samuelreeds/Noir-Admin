import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Plus } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Image } from "@/components/ui/image";

export default function ProductCard({ product, index = 0 }) {
  const { addItem, toggleWishlist, isInWishlist } = useCart();
  const [hovered, setHovered] = useState(false);
  const liked = isInWishlist(product.id);

  const hasDiscount = product.discount_price != null && product.discount_price < product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0;
  const secondary = product.images?.[1] || product.images?.[0];
  const lowStock = product.stock > 0 && product.stock <= 5;
  const soldOut = product.stock <= 0;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative overflow-hidden bg-muted aspect-[4/5]">
        <Image
          src={product.images?.[0]}
          alt={product.name}
          className={`w-full h-full transition-opacity duration-700 ${hovered && secondary ? "opacity-0" : "opacity-100"}`}
          fittingType="fill"
        />
        {secondary && (
          <Image
            src={secondary}
            alt={product.name}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${hovered ? "opacity-100" : "opacity-0"}`}
            fittingType="fill"
          />
        )}

        {/* badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.is_new && <span className="label-mono bg-background/90 px-2 py-1">New</span>}
          {hasDiscount && <span className="label-mono bg-foreground text-background px-2 py-1">−{discountPct}%</span>}
          {soldOut && <span className="label-mono bg-foreground text-background px-2 py-1">Sold Out</span>}
          {lowStock && !soldOut && <span className="label-mono bg-background/90 px-2 py-1">Low Stock</span>}
        </div>

        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          aria-label="Toggle wishlist"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-background/90 hover:bg-background transition-colors"
        >
          <Heart size={14} strokeWidth={1.5} fill={liked ? "currentColor" : "none"} className={liked ? "text-foreground" : ""} />
        </button>

        {/* Quick-add drawer */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur transition-transform duration-500 ${hovered && !soldOut ? "translate-y-0" : "translate-y-full"}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
        >
          <div className="p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="label-mono text-muted-foreground">Quick Add</span>
              <Plus size={12} strokeWidth={1.5} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(product.sizes || ["ONE SIZE"]).slice(0, 5).map((size) => (
                <button
                  key={size}
                  onClick={(e) => {
                    e.preventDefault();
                    addItem(product, { size, color: (product.colors || ["Default"])[0], quantity: 1 });
                  }}
                  className="px-2.5 py-1.5 border hairline label-mono text-[10px] hover:bg-foreground hover:text-background transition-colors"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium truncate">{product.name}</h3>
          <p className="label-mono text-muted-foreground mt-0.5 truncate">{product.material || "Premium Fabric"}</p>
        </div>
        <div className="text-right shrink-0">
          {hasDiscount ? (
            <>
              <span className="font-mono text-sm line-through text-muted-foreground mr-1.5">${product.price.toFixed(2)}</span>
              <span className="font-mono text-sm">${product.discount_price.toFixed(2)}</span>
            </>
          ) : (
            <span className="font-mono text-sm">${product.price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}