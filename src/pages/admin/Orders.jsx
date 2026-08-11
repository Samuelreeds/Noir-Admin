import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Printer, Search, Printer as PrintIcon, Eye, X, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

export default function Orders() {
  // Filter states
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination & Selection states
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState(/** @type {string[]} */ ([]));

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(/** @type {any} */ (null));
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 1. Fetch live orders using React Query for INSTANT CACHING
  const { data: orders = [], isLoading: loading, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          payment_method,
          shipping_address,
          subtotal,
          shipping_fee,
          tax,
          grand_total,
          order_items ( id, product_name, unit_price, quantity, selected_size, selected_color, total_price )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Data stays fresh in cache for 5 minutes
  });

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedOrderIds([]); // Clear selections when filtering
  }, [statusFilter, searchQuery, dateFrom, dateTo]);

  // Apply Filters
  const filteredOrders = orders.filter((/** @type {any} */ order) => {
    if (statusFilter !== 'All Status' && order.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const addr = order.shipping_address || {};
      const searchString = `${order.id} ${addr.name || ''} ${addr.phone || ''} ${addr.address || ''} ${addr.province || ''}`.toLowerCase();
      if (!searchString.includes(q)) return false;
    }

    if (dateFrom && new Date(order.created_at) < new Date(dateFrom)) return false;
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (new Date(order.created_at) > toDate) return false;
    }

    return true;
  });

  // 2. Pagination Logic (20 items per page)
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 3. Checkbox Handlers
  const isAllSelected = filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length;

  const handleSelectAll = (/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => {
    if (e.target.checked) {
      // Select all filtered orders
      setSelectedOrderIds(filteredOrders.map((/** @type {any} */ o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOne = (/** @type {string} */ id) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  // Export to Excel (CSV) - Exports Selected Data (or all filtered if none selected)
  const exportToCSV = () => {
    const dataToExport = selectedOrderIds.length > 0 
      ? filteredOrders.filter((/** @type {any} */ o) => selectedOrderIds.includes(o.id))
      : filteredOrders;

    if (dataToExport.length === 0) return alert("No data to export!");
    
    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Location', 'Address', 'Total Items', 'Payment', 'Status', 'Grand Total'];
    const rows = dataToExport.map((/** @type {any} */ order) => {
      const addr = order.shipping_address || {};
      return [
        `MA-${order.id.slice(-8).toUpperCase()}`,
        new Date(order.created_at).toLocaleDateString(),
        addr.name || 'N/A',
        addr.phone || 'N/A',
        addr.province || 'N/A',
        addr.address || 'N/A',
        order.order_items?.length || 0,
        order.payment_method === 'qr' ? 'Bank / QR' : order.payment_method,
        order.status,
        order.grand_total || 0
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal Handlers
  const openViewModal = (/** @type {any} */ order) => { setSelectedOrder(order); setIsViewModalOpen(true); };
  const openPrintModal = (/** @type {any} */ order) => { setSelectedOrder(order); setIsPrintModalOpen(true); };
  const closeModals = () => {
    setIsViewModalOpen(false); setIsPrintModalOpen(false);
    setTimeout(() => setSelectedOrder(null), 200); 
  };
  const executePrint = () => { window.print(); closeModals(); };

  // Date Formatter
  const formatDate = (/** @type {string} */ isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer"
          >
            <option>All Status</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <div className="flex items-center border border-slate-300 rounded bg-white px-3">
            <span className="text-xs text-slate-400 mr-2">From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none text-slate-600 cursor-pointer" />
            <span className="text-xs text-slate-400 mx-3">—</span>
            <span className="text-xs text-slate-400 mr-2">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none text-slate-600 cursor-pointer" />
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, name, phone, or address..." 
              className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-[300px] md:w-[400px] outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-3">
           <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
              <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
           </button>
           <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
              <Download size={14} /> Export Excel {selectedOrderIds.length > 0 && `(${selectedOrderIds.length})`}
           </button>
           <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
              <Printer size={14} /> Print List
           </button>
         </div>
         {selectedOrderIds.length > 0 && (
           <div className="text-sm font-medium text-emerald-600">
             {selectedOrderIds.length} item(s) selected
           </div>
         )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 cursor-pointer" 
                />
              </th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer Info</th>
              <th className="px-4 py-3">Shipping To</th>
              <th className="px-4 py-3">Total Items</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading orders...</td></tr>
            ) : paginatedOrders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No orders found.</td></tr>
            ) : (
              paginatedOrders.map((/** @type {any} */ order) => {
                const addr = order.shipping_address || {};
                const isSelected = selectedOrderIds.includes(order.id);
                
                return (
                  <tr key={order.id} className={`hover:bg-slate-50/50 ${isSelected ? "bg-slate-50" : ""}`}>
                    <td className="px-4 py-4">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleSelectOne(order.id)}
                        className="rounded border-slate-300 cursor-pointer" 
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800">MA-{order.id.slice(-8).toUpperCase()}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDate(order.created_at)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-slate-800">{addr.name || 'N/A'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{addr.phone || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-slate-800">{addr.province || 'N/A'}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[150px]">{addr.address || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-800 font-medium">{order.order_items?.length || 0}</td>
                    <td className="px-4 py-4">
                      <div className="text-slate-800 text-xs uppercase">{order.payment_method === 'qr' ? 'Bank / QR' : order.payment_method}</div>
                      {order.payment_method !== 'cod' && (
                        <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium mt-1">Paid</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                        order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button onClick={() => openPrintModal(order)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Print Invoice">
                          <PrintIcon size={16} />
                        </button>
                        <button onClick={() => openViewModal(order)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="View Details">
                          <Eye size={16} />
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

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="text-sm text-slate-500">
          Showing {filteredOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} entries
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

      {/* --- OVERLAY MODALS --- */}
      
      {/* 1. Detail View Modal */}
      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Order Details</h2>
                <p className="text-xs text-slate-500 font-mono mt-1">MA-{selectedOrder.id.toUpperCase()}</p>
              </div>
              <button onClick={closeModals} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Customer Information</p>
                  <p className="text-sm font-medium text-slate-900">{selectedOrder.shipping_address?.name}</p>
                  <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.email}</p>
                  <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Shipping Address</p>
                  <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.address}</p>
                  <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.province}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Order Items</p>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 font-medium text-slate-600">Product</th>
                        <th className="px-4 py-2 font-medium text-slate-600 text-center">Qty</th>
                        <th className="px-4 py-2 font-medium text-slate-600 text-right">Price</th>
                        <th className="px-4 py-2 font-medium text-slate-600 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.order_items?.map((/** @type {any} */ item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{item.product_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.selected_color} · {item.selected_size}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-600">${item.unit_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">${item.total_price?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full sm:w-1/2 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>${selectedOrder.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span>{selectedOrder.shipping_fee === 0 ? 'Free' : `$${selectedOrder.shipping_fee?.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pb-3 border-b border-slate-200">
                    <span>Tax</span>
                    <span>${selectedOrder.tax?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-900 pt-1 text-base">
                    <span>Grand Total</span>
                    <span>${selectedOrder.grand_total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={closeModals} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Print Options Modal */}
      {isPrintModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
             <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-700">
               <Printer size={24} />
             </div>
             <h2 className="text-lg font-semibold text-slate-900 mb-1">Print Document</h2>
             <p className="text-sm text-slate-500 mb-6 font-mono">MA-{selectedOrder.id.slice(-8).toUpperCase()}</p>
             
             <div className="flex flex-col gap-3">
               <button onClick={executePrint} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded font-medium hover:bg-slate-700 transition-colors">
                 <FileText size={16} /> Download as PDF
               </button>
               <button onClick={executePrint} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded font-medium hover:bg-slate-50 transition-colors">
                 <PrintIcon size={16} /> Print Out
               </button>
               <button onClick={closeModals} className="mt-2 text-sm text-slate-500 hover:text-slate-800 font-medium">
                 Cancel
               </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}