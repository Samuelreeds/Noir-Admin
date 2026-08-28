// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Eye, Trash2, Ban, ChevronLeft, ChevronRight, X, Unlock, ArrowLeft, ExternalLink, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;
const KHR_RATE = 4100;

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [viewCustomer, setViewCustomer] = useState(/** @type {any} */ (null));
  const [deleteCustomer, setDeleteCustomer] = useState(/** @type {any} */ (null));
  const [blockCustomer, setBlockCustomer] = useState(/** @type {any} */ (null));

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-customers-with-orders'],
    queryFn: async () => {
      const { data: profiles, error: pError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (pError) throw pError;

      const { data: orders, error: oError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (oError) throw oError;

      return (profiles || []).map((/** @type {any} */ profile) => {
        const userOrders = (orders || []).filter(o => o.user_id === profile.id);
        const totalSpend = userOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
        return { ...profile, orders: userOrders, totalOrders: userOrders.length, totalSpend: totalSpend, status: profile.status || 'active' };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers-with-orders'] });
      setDeleteCustomer(null);
    },
    onError: (err) => { alert(`Error deleting customer: ${err.message}.`); }
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async (/** @type {{ id: string, currentStatus: string }} */ { id, currentStatus }) => {
      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers-with-orders'] });
      setBlockCustomer(null);
      if (viewCustomer) { setViewCustomer((/** @type {any} */ prev) => prev ? ({ ...prev, status: prev.status === 'blocked' ? 'active' : 'blocked' }) : null); }
    },
    onError: (err) => alert(err.message)
  });

  const exportAllCustomersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('export_all_customers');
      if (error) throw error;
      return data;
    },
    onSuccess: (dataToExport) => {
      if (!dataToExport || dataToExport.length === 0) return alert("No data to export!");
      const headers = ['ID', 'Name', 'Email', 'Phone', 'Register At', 'Total Orders', 'Total Spend (USD)', 'Status'];
      const rows = dataToExport.map((/** @type {any} */ c) => {
        return [
          c.id, c.full_name || 'N/A', c.email || 'N/A', c.phone || 'N/A',
          new Date(c.created_at).toLocaleString(), c.total_orders, c.total_spend,
          c.status.toUpperCase()
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });
      const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `customers_export_FULL_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    },
    onError: (err) => alert("Export failed: " + err.message)
  });

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const filteredCustomers = customers.filter((/** @type {any} */ customer) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchString = `${customer.id} ${customer.full_name || ''} ${customer.email || ''} ${customer.phone || ''}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE) || 1;
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const formatDateTime = (/** @type {string} */ iso) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    const pad = (/** @type {number} */ n) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  };

  const formatDateShort = (/** @type {string} */ iso) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getAvatarColor = (/** @type {string} */ name) => {
    const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500'];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  if (viewCustomer) {
    const displayName = viewCustomer.full_name || viewCustomer.email?.split('@')[0] || 'Unknown';
    const initial = displayName.charAt(0).toUpperCase();
    const isBlocked = viewCustomer.status === 'blocked';

    return (
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewCustomer(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors" title="Back to list">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CUSTOMER PROFILE</h1>
              <p className="text-xs text-slate-500 mt-0.5">Member since {formatDateShort(viewCustomer.created_at)}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
            isBlocked ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}>
            {isBlocked ? 'BLOCKED' : 'ACTIVE'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 uppercase tracking-wider">
              Customer Details
            </div>
            <div className="p-6 space-y-6 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto shadow-sm ${isBlocked ? 'bg-slate-400' : getAvatarColor(initial)}`}>
                {initial}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>
                <p className="text-xs text-slate-500 mt-1">{viewCustomer.email || 'No email provided'}</p>
              </div>

              <div className="border-t border-slate-100 pt-6 text-left space-y-4 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 font-medium">Joined</span><span className="text-slate-900">{formatDateShort(viewCustomer.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">Status</span><span className={`font-semibold uppercase text-xs ${isBlocked ? 'text-rose-600' : 'text-emerald-600'}`}>{viewCustomer.status}</span></div>
                <div className="flex flex-col gap-1"><span className="text-slate-500 font-medium text-xs">ID</span><span className="text-slate-700 font-mono text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200 break-all">{viewCustomer.id}</span></div>
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  onClick={() => setBlockCustomer(viewCustomer)} 
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                    isBlocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {isBlocked ? <Unlock size={14} /> : <Ban size={14} />}
                  {isBlocked ? 'Unblock Customer' : 'Block Customer'}
                </button>
                <button 
                  onClick={() => setDeleteCustomer(viewCustomer)} 
                  className="py-2 px-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center justify-center"
                  title="Delete Customer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700"><Package size={22} /></div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{viewCustomer.totalOrders}</p>
                </div>
              </div>
              <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-lg">$</div>
                <div>
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Spent</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-0.5">${viewCustomer.totalSpend.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Recent Orders ({viewCustomer.totalOrders} total)</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-3">Order Ref</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewCustomer.orders.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No orders placed yet by this customer.</td></tr>
                    ) : (
                      viewCustomer.orders.map((/** @type {any} */ order) => {
                        const orderRef = `#BARE-${order.id.slice(-8).toUpperCase()}`;
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-semibold text-slate-900 font-mono text-xs">{orderRef}</td>
                            <td className="px-6 py-4 text-slate-600">{formatDateShort(order.created_at)}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                                order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {order.status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">${order.grand_total?.toFixed(2) || '0.00'}</td>
                            <td className="px-6 py-4 text-right">
                              <a href={`/admin/orders`} className="text-blue-600 hover:text-blue-800 font-medium text-xs inline-flex items-center gap-1">
                                View <ExternalLink size={12} />
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
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
          <button onClick={() => exportAllCustomersMutation.mutate()} disabled={exportAllCustomersMutation.isPending} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors disabled:opacity-50">
            {exportAllCustomersMutation.isPending ? <RefreshCcw size={14} className="animate-spin" /> : <Download size={14} />} Export Full DB
          </button>
        </div>
      </div>

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
                const isBlocked = customer.status === 'blocked';

                return (
                  <tr key={customer.id} className={`hover:bg-slate-50/50 ${isBlocked ? 'opacity-60 bg-slate-50' : ''}`}>
                    <td className="px-4 py-4 text-center text-slate-500">{displayId}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${isBlocked ? 'bg-slate-400' : getAvatarColor(initial)}`}>
                          {initial}
                        </div>
                        <div>
                          <p className={`font-medium ${isBlocked ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{displayName}</p>
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
                      <span className={`inline-block px-2.5 py-1 border rounded-full text-[10px] font-medium tracking-wider ${
                        isBlocked ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}>
                        {isBlocked ? 'BLOCKED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button onClick={() => setViewCustomer(customer)} className="p-1.5 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="View Details">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => setDeleteCustomer(customer)} className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete">
                          <Trash2 size={16} />
                        </button>
                        <button onClick={() => setBlockCustomer(customer)} className="p-1.5 flex items-center gap-1 hover:text-amber-600 transition-colors border border-transparent hover:border-slate-300 rounded" title={isBlocked ? "Unblock" : "Block"}>
                          {isBlocked ? <Unlock size={16} /> : <Ban size={16} />} 
                          <span className="text-xs">{isBlocked ? 'Unblock' : 'Block'}</span>
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

      <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="text-sm text-slate-500">
          Showing {filteredCustomers.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} of {filteredCustomers.length} entries
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} /> Previous
          </button>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {deleteCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-rose-500" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Customer?</h2>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete <span className="font-semibold text-slate-800">{deleteCustomer.full_name || 'this customer'}</span>? This action cannot be undone.</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setDeleteCustomer(null)} disabled={deleteMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteCustomer.id)} disabled={deleteMutation.isPending} className="px-5 py-2.5 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors w-full flex items-center justify-center gap-2">
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {blockCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${blockCustomer.status === 'blocked' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                {blockCustomer.status === 'blocked' ? <Unlock size={28} /> : <Ban size={28} />}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{blockCustomer.status === 'blocked' ? 'Unblock Customer?' : 'Block Customer?'}</h2>
              <p className="text-sm text-slate-500 mb-6">
                {blockCustomer.status === 'blocked' 
                  ? `Are you sure you want to restore access for ${blockCustomer.full_name || 'this customer'}?` 
                  : `Are you sure you want to block ${blockCustomer.full_name || 'this customer'}? They will be marked as blocked in your database.`}
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setBlockCustomer(null)} disabled={toggleBlockMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">Cancel</button>
                <button onClick={() => toggleBlockMutation.mutate({ id: blockCustomer.id, currentStatus: blockCustomer.status })} disabled={toggleBlockMutation.isPending} className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors w-full flex items-center justify-center gap-2 ${blockCustomer.status === 'blocked' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {toggleBlockMutation.isPending ? 'Updating...' : blockCustomer.status === 'blocked' ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}