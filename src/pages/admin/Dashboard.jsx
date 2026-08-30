// @ts-nocheck
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingBag, DollarSign, AlertTriangle, ArrowUpRight, TrendingUp, XOctagon, Calendar, RefreshCcw, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery } from '@tanstack/react-query';

// Local price formatter for the Admin Dashboard
const formatPrice = (/** @type {number | null | undefined} */ val) => {
  if (val === null || val === undefined) return '$0.00';
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Unified KPI Card Component
const KpiCard = ({ label = "", value = "", sub = "", icon: Icon, accent = "" }) => (
  <div className={`p-6 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors ${accent}`}>
    <div className="flex items-start justify-between mb-4">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
        <Icon size={18} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">{label}</span>
    </div>
    <div>
      <h3 className="text-3xl font-display font-bold text-slate-900 tracking-tight">{value}</h3>
      <p className="text-xs text-slate-500 mt-1 font-medium">{sub}</p>
    </div>
  </div>
);

export default function AdminDashboard() {
  // Date Filtering State (Default: Last 30 Days)
  const [dateRange, setDateRange] = useState('30D');
  
  const getDateBounds = () => {
    const end = new Date();
    const start = new Date();
    if (dateRange === '7D') start.setDate(end.getDate() - 7);
    else if (dateRange === '30D') start.setDate(end.getDate() - 30);
    else if (dateRange === 'MTD') start.setDate(1);
    else if (dateRange === 'YTD') { start.setMonth(0, 1); }
    else return { start: null, end: null }; // All Time
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  };

  const bounds = getDateBounds();

  const { data: kpiData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard-kpis', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_kpis', { 
        p_start_date: bounds.start, 
        p_end_date: bounds.end 
      });
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000 // Cache for 2 mins
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aggregating Metrics...</p>
        </div>
      </div>
    );
  }

  const stats = kpiData || {};
  const recentOrders = stats.recentOrders || [];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* Header & Global Filters */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">— Executive Overview</p>
          <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight uppercase">Dashboard</h1>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
          <Calendar size={16} className="text-slate-400 ml-2" />
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)} 
            className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer pr-4 text-slate-700"
          >
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="MTD">Month to Date</option>
            <option value="YTD">Year to Date</option>
            <option value="ALL">All Time</option>
          </select>
          <button onClick={() => refetch()} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors ml-2" title="Refresh Data">
            <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Primary Financial KPIs */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Financial Performance {dateRange !== 'ALL' && <span className="text-slate-400 font-normal">({dateRange})</span>}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Net Sales" value={formatPrice(stats.netSales)} sub="Gross sales minus processed refunds" icon={TrendingUp} accent="border-b-4 border-b-slate-900" />
          <KpiCard label="Avg Order Value" value={formatPrice(stats.aov)} sub="Per paid/completed order" icon={DollarSign} />
          <KpiCard label="Total Orders" value={stats.totalOrders} sub="Paid or partially refunded" icon={ShoppingBag} />
          <KpiCard label="Refunded Value" value={formatPrice(stats.totalRefunds)} sub="Formally restocked via credit notes" icon={ArrowRightLeft} accent="border-b-4 border-b-rose-500" />
        </div>
      </div>

      {/* Inventory & Operational KPIs */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Global Operations <span className="text-slate-400 font-normal">(Real-time Snapshot)</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Total Inventory Value" value={formatPrice(stats.inventoryValue)} sub="Calculated from variant unit cost" icon={Package} accent="bg-slate-50 border-dashed" />
          <KpiCard label="Active Products" value={stats.totalProducts} sub="Currently published to storefront" icon={Package} />
          <KpiCard label="Low Stock Variants" value={stats.lowStock} sub="Available ≤ 5 units" icon={AlertTriangle} accent={stats.lowStock > 0 ? "border-amber-400 bg-amber-50/30" : ""} />
          <KpiCard label="Out of Stock" value={stats.outOfStock} sub="Available ≤ 0 units" icon={XOctagon} accent={stats.outOfStock > 0 ? "border-rose-300 bg-rose-50/50" : ""} />
        </div>
      </div>

      {/* Bottom Grid: Chart & Recent Orders */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        
        {/* Simple CSS Bar Chart for Sales Trend */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Gross Sales Trend</h2>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Daily Breakdown</span>
          </div>
          <div className="p-6 flex-1 flex items-end justify-between gap-1 h-[300px]">
            {stats.salesChart?.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400 font-medium italic">No sales data for this period.</div>
            ) : (
              stats.salesChart?.map((/** @type {any} */ day, /** @type {number} */ i) => {
                const maxSale = Math.max(...stats.salesChart.map((/** @type {any} */ d) => d.sales));
                const heightPct = maxSale > 0 ? Math.max((day.sales / maxSale) * 100, 2) : 2;
                return (
                  <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                    <div 
                      className="w-full bg-slate-200 rounded-t-sm transition-all duration-500 group-hover:bg-slate-800" 
                      style={{ height: `${heightPct}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none font-medium shadow-lg">
                      {new Date(day.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}: {formatPrice(day.sales)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Orders Stream */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Activity</h2>
            <Link to="/orders" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1 transition-colors">
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {recentOrders.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center font-medium italic">No recent orders.</p>
            ) : (
              recentOrders.map((/** @type {any} */ o) => (
                <Link key={o.id} to="/orders" className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors group block">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                      {o.customer_name || "Guest Customer"}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                      {o.invoice_number || `MA-${String(o.id).slice(-8).toUpperCase()}`} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                      o.fulfilment_status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      o.fulfilment_status === 'Failed Delivery' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {o.fulfilment_status || 'Unconfirmed'}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      o.payment_status === 'Paid' ? 'text-emerald-600' : o.payment_status === 'Failed' ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {o.payment_status || 'Unpaid'}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}