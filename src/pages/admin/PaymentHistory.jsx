import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Calendar, DollarSign, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;
const KHR_RATE = 4100; // Standard exchange rate for display purposes

export default function PaymentHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // 1. Replaced single date filter with date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [currencyFilter, setCurrencyFilter] = useState('All Currency');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch live orders with caching
  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, payment_method, shipping_address, 
          grand_total, shipping_fee, order_items(id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Reset pagination on search or filter changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery, startDate, endDate, currencyFilter]);

  // Calculate Summary Metrics (Top Cards)
  const totalOrders = orders.length;
  const totalRevenueUSD = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
  const totalRevenueKHR = totalRevenueUSD * KHR_RATE;
  const totalShippingUSD = orders.reduce((sum, o) => sum + (o.shipping_fee || 0), 0);
  const totalShippingKHR = totalShippingUSD * KHR_RATE;

  // 2. Updated Filter Logic with Date Range
  const filteredOrders = orders.filter((/** @type {any} */ order) => {
    // Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const addr = order.shipping_address || {};
      const searchString = `${order.id} ${addr.name || ''} ${addr.phone || ''}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }
    
    // Date Range Filter (Using ISO string comparison)
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    if (startDate && orderDate < startDate) return false;
    if (endDate && orderDate > endDate) return false;
    
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Formatting helper to apply the Currency Filter to the UI
  const formatPrice = (/** @type {number} */ usdAmount) => {
    if (currencyFilter === 'KHR') return `${(usdAmount * KHR_RATE).toLocaleString()} ៛`;
    return `$${usdAmount.toFixed(2)}`; // Defaults to USD for "All Currency" or "USD"
  };

  // 3. Export to Excel (Refined for Date Range and active Currency)
  const exportToCSV = () => {
    if (filteredOrders.length === 0) return alert("No data to export!");
    
    const isKHR = currencyFilter === 'KHR';
    const currencyLabel = isKHR ? 'KHR' : 'USD';
    
    const headers = [
      'Order ID', 'Date', 'Customer Name', 'Shipping To', 
      'Total Items', 'Payment Option', 'Status', 
      `Price (${currencyLabel})`, `Shipping Fee (${currencyLabel})`
    ];
    
    const rows = filteredOrders.map((/** @type {any} */ o) => {
      const addr = o.shipping_address || {};
      
      const priceOutput = isKHR ? (o.grand_total * KHR_RATE) : o.grand_total;
      const shippingOutput = isKHR ? (o.shipping_fee * KHR_RATE) : o.shipping_fee;

      return [
        `MA-${o.id.slice(-8).toUpperCase()}`,
        new Date(o.created_at).toLocaleDateString(),
        addr.name || 'N/A',
        addr.province || 'N/A',
        o.order_items?.length || 0,
        o.payment_method === 'qr' ? 'ABA PAYWAY' : o.payment_method,
        o.status,
        priceOutput || 0,
        shippingOutput || 0
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // Dynamic filename based on date range
    let dateStr = new Date().toISOString().split('T')[0];
    if (startDate && endDate) dateStr = `${startDate}_to_${endDate}`;
    else if (startDate) dateStr = `from_${startDate}`;
    else if (endDate) dateStr = `until_${endDate}`;

    link.setAttribute('download', `payment_history_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (/** @type {string} */ iso) => {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-6">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-slate-600"><ShoppingCart size={20} /></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Order</p>
            <p className="text-xl font-bold text-slate-900">{totalOrders.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">All customer order</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-slate-600"><ShoppingCart size={20} /></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Product Sold (USD)</p>
            <p className="text-xl font-bold text-slate-900">${totalRevenueUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Products have been sold.</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-slate-600"><ShoppingCart size={20} /></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Product Sold (KHR)</p>
            <p className="text-xl font-bold text-slate-900">{totalRevenueKHR.toLocaleString()} ៛</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Products have been sold.</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-slate-600"><Truck size={20} /></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Shipping Fee</p>
            <p className="text-xl font-bold text-slate-900">${totalShippingUSD.toLocaleString()} | {totalShippingKHR.toLocaleString()} ៛</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Total shipping fee in USD and KHR.</p>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col flex-1 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            
            {/* Start Date / End Date Range Inputs */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-slate-300 rounded pl-9 pr-3 py-2 text-sm bg-white outline-none cursor-pointer" />
              </div>
              <span className="text-slate-400 text-sm">to</span>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-slate-300 rounded pl-9 pr-3 py-2 text-sm bg-white outline-none cursor-pointer" />
              </div>
            </div>

            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
              <option>All Currency</option>
              <option>USD</option>
              <option>KHR</option>
            </select>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-[250px] outline-none focus:border-slate-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
              <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
              <Download size={14} /> Export Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer Info</th>
                <th className="px-4 py-3">Shipping To</th>
                <th className="px-4 py-3 text-center">Total Items</th>
                <th className="px-4 py-3">Payment Option</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Shipping Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading data...</td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No payment history found.</td></tr>
              ) : (
                paginatedOrders.map((/** @type {any} */ order) => {
                  const addr = order.shipping_address || {};
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">MA-{order.id.slice(-8).toUpperCase()}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatDate(order.created_at)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800">{addr.name || 'N/A'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{addr.email || addr.phone}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800">{addr.province || 'N/A'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">N/A</div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-800">{order.order_items?.length || 0}</td>
                      <td className="px-4 py-4 text-slate-800 text-xs uppercase">{order.payment_method === 'qr' ? 'ABA PAYWAY' : order.payment_method}</td>
                      <td className="px-4 py-4">
                        <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium border border-emerald-200">
                          {order.status === 'pending' ? 'Paid' : 'Delivered'}
                        </span>
                      </td>
                      
                      {/* Price cells updated to use dynamic formatPrice helper */}
                      <td className="px-4 py-4 text-right font-medium text-slate-900">{formatPrice(order.grand_total || 0)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{formatPrice(order.shipping_fee || 0)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-sm text-slate-500">
            Showing {filteredOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} entries
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50">Prev</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50">Next</button>
          </div>
        </div>

      </div>
    </div>
  );
}