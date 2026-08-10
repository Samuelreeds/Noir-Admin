import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingBag, DollarSign, AlertTriangle, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import StatCard from "@/components/admin/StatCard";

// Explicitly type the object so it allows string indexing
/** @type {Record<string, string>} */
const STATUS_COLORS = {
  pending: "bg-muted text-foreground", paid: "bg-foreground text-background",
  processing: "bg-amber-100 text-amber-900", shipping: "bg-blue-100 text-blue-900",
  delivered: "bg-emerald-100 text-emerald-900", cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, lowStock: 0 });
  const [recent, setRecent] = useState(/** @type {any[]} */ ([]));
  const [byStatus, setByStatus] = useState(/** @type {any[]} */ ([]));

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, orderRes] = await Promise.all([
          supabase.from("products").select("stock").limit(200),
          supabase.from("orders").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(200),
        ]);

        const products = prodRes.data || [];
        const orders = orderRes.data || [];

        const revenue = orders
          .filter((/** @type {any} */ o) => ["paid", "processing", "shipping", "delivered"].includes(o.status))
          .reduce((/** @type {number} */ s, /** @type {any} */ o) => s + (Number(o.grand_total) || Number(o.total) || 0), 0);
          
        const lowStock = products.filter((/** @type {any} */ p) => p.stock <= 5).length;
        
        setStats({ products: products.length, orders: orders.length, revenue, lowStock });
        setRecent(orders.slice(0, 6));
        
        /** @type {Record<string, number>} */
        const counts = {};
        orders.forEach((/** @type {any} */ o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
        setByStatus(Object.entries(counts).map(([name, count]) => ({ name, count })));
      } catch (e) { 
        console.error("Dashboard fetch error:", e); 
      }
      setLoading(false);
    })();
  }, []);

  const maxCount = Math.max(1, ...byStatus.map((/** @type {any} */ b) => b.count));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="label-mono text-muted-foreground mb-2">— Overview</p>
        <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] leading-none">Dashboard.</h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={`$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Realized orders" icon={DollarSign} accent="" />
        <StatCard label="Orders" value={stats.orders} sub="All time" icon={ShoppingBag} accent="" />
        <StatCard label="Products" value={stats.products} sub="In catalog" icon={Package} accent="" />
        <StatCard label="Low Stock" value={stats.lowStock} sub="≤ 5 units" icon={AlertTriangle} accent={stats.lowStock ? "border-amber-400" : ""} />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Recent orders */}
        <div className="border hairline">
          <div className="flex items-center justify-between px-6 py-4 border-b hairline">
            <h2 className="font-display text-xl tracking-[-0.04em]">Recent Orders</h2>
            <Link to="/admin/orders" className="label-mono text-muted-foreground hover:text-foreground flex items-center gap-1">All <ArrowUpRight size={12} /></Link>
          </div>
          <div className="divide-y hairline">
            {recent.length === 0 && <p className="px-6 py-8 text-sm text-muted-foreground">No orders yet.</p>}
            {recent.map((/** @type {any} */ o) => (
              <div key={o.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm truncate">{o.profiles?.full_name || o.shipping_address?.name || "Guest"}</p>
                  <p className="label-mono text-muted-foreground text-[9px] mt-1">{o.order_number || String(o.id).slice(-8).toUpperCase()}</p>
                </div>
                <span className={`label-mono text-[9px] px-2 py-1 ${STATUS_COLORS[o.status] || "bg-muted"}`}>{o.status}</span>
                <p className="font-mono text-sm w-20 text-right">${(Number(o.grand_total) || Number(o.total) || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by status */}
        <div className="border hairline p-6">
          <h2 className="font-display text-xl tracking-[-0.04em] mb-6">By Status</h2>
          {byStatus.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
          <div className="space-y-4">
            {byStatus.map((/** @type {any} */ b) => (
              <div key={b.name}>
                <div className="flex items-center justify-between label-mono text-[9px] mb-1.5">
                  <span className="capitalize">{b.name}</span>
                  <span className="text-muted-foreground">{b.count}</span>
                </div>
                <div className="h-1.5 bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}