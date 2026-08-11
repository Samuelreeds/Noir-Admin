import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Eye, Trash2, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;
const KHR_RATE = 4100;

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Fetch live customers and aggregate their order totals
  const { data: customers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      // Fetch all profiles (customers)
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (pError) throw pError;

      // Fetch all orders to calculate lifetime spend
      const { data: orders, error: oError } = await supabase
        .from('orders')
        .select('user_id, grand_total, status');

      if (oError) throw oError;

      // Merge the data
      return (profiles || []).map((/** @type {any} */ profile) => {
        const userOrders = (orders || []).filter(o => o.user_id === profile.id);
        const totalSpend = userOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
        
        return {
          ...profile,
          totalOrders: userOrders.length,
          totalSpend: totalSpend
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // 2. Filter Logic
  const filteredCustomers = customers.filter((/** @type {any} */ customer) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchString = `${customer.id} ${customer.full_name || ''} ${customer.email || ''} ${customer.phone || ''}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }
    return true;
  });

  // 3. Pagination
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE) || 1;
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // 4. Export to Excel
  const exportToCSV = () => {
    if (filteredCustomers.length === 0) return alert("No data to export!");
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Register At', 'Total Orders', 'Total Spend (USD)', 'Total Spend (KHR)', 'Status'];
    const rows = filteredCustomers.map((/** @type {any} */ c) => {
      return [
        c.id,
        c.full_name || 'N/A',
        c.email || 'N/A',
        c.phone || 'N/A',
        formatDateTime(c.created_at),
        c.totalOrders,
        c.totalSpend,
        c.totalSpend * KHR_RATE,
        'ACTIVE'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // UI Helpers
  const formatDateTime = (/** @type {string} */ iso) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    const pad = (/** @type {number} */ n) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  };

  const getAvatarColor = (/** @type {string} */ name) => {
    const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500'];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
        <div className="relative flex-1 max-w-lg">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by name, phone, email, or customer ID..." 
            className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" 
          />
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
              <th className="px-4 py-3 w-12 text-center">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Register At</th>
              <th className="px-4 py-3 text-center">Total Order</th>
              <th className="px-4 py-3 text-right">Total Spend (USD)</th>
              <th className="px-4 py-3 text-right">Total Spend (KHR)</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading customers...</td></tr>
            ) : paginatedCustomers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No customers found.</td></tr>
            ) : (
              paginatedCustomers.map((/** @type {any} */ customer, index) => {
                const displayName = customer.full_name || customer.email?.split('@')[0] || 'Unknown';
                const initial = displayName.charAt(0).toUpperCase();
                const displayId = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

                return (
                  <tr key={customer.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 text-center text-slate-500">{displayId}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(initial)}`}>
                          {initial}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{displayName}</p>
                          <p className="text-xs text-slate-500">{customer.phone || customer.email || 'No contact info'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDateTime(customer.created_at)}</td>
                    <td className="px-4 py-4 text-center text-slate-600">
                      {customer.totalOrders === 0 ? 'No Orders' : `${customer.totalOrders} orders`}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-800 font-medium">
                      ${customer.totalSpend.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {(customer.totalSpend * KHR_RATE).toLocaleString()} ៛
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[10px] font-medium tracking-wider">
                        ACTIVE
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="View Details">
                          <Eye size={14} />
                        </button>
                        <button className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete">
                          <Trash2 size={14} />
                        </button>
                        <button className="p-1.5 flex items-center gap-1 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Block">
                          <Ban size={14} /> <span className="text-xs">Block</span>
                        </button>
                      </div>
                    </td>
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
          Showing {filteredCustomers.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} of {filteredCustomers.length} entries
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}