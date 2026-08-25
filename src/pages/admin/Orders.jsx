// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, Download, Printer, Search, Eye, X, FileText, ChevronLeft, ChevronRight,
  Package, Truck, CheckCircle, Camera, CreditCard, MapPin, User, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ShippingLabel from '@/components/admin/ShippingLabel';
import ReceiptTemplate from '@/components/admin/ReceiptTemplate';

const ITEMS_PER_PAGE = 20;

// --- IMAGE UPLOAD HELPER ---
const uploadProofFileToSupabase = async (/** @type {File} */ file, /** @type {string} */ prefix, /** @type {string} */ orderId) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${prefix}_${orderId}_${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('order-proofs').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('order-proofs').getPublicUrl(fileName);
  return data.publicUrl;
};

export default function Orders() {
  const [fulfilmentFilter, setFulfilmentFilter] = useState('All Fulfilment');
  const [paymentFilter, setPaymentFilter] = useState('All Payment');
  const [currencyFilter, setCurrencyFilter] = useState('All Currency');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState(/** @type {string[]} */ ([]));

  const [selectedOrder, setSelectedOrder] = useState(/** @type {any} */ (null));
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [printMode, setPrintMode] = useState(/** @type {'label' | 'receipt' | null} */ (null));
  const [uploadingProof, setUploadingProof] = useState(/** @type {string | null} */ (null));

  const queryClient = useQueryClient();

  // 1. Fetch live orders (Updated with new 3-dimensional statuses)
  const { data: orders = [], isLoading: loading, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, payment_status, fulfilment_status, commercial_status, 
          payment_method, shipping_address, subtotal, shipping_fee, tax, grand_total, currency,
          packed_at, shipped_at, delivered_at, internal_proof_url, delivery_proof_url, transaction_reference, transaction_receipt_url,
          order_items ( id, product_name, unit_price, quantity, selected_size, selected_color, total_price )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Multi-Dimensional Status Update Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (/** @type {{ id: string, payment_status?: string, fulfilment_status?: string, timestampField?: string }} */ payload) => {
      const { id, payment_status, fulfilment_status, timestampField } = payload;
      
      const updateData = {};
      if (payment_status) updateData.payment_status = payment_status;
      if (fulfilment_status) updateData.fulfilment_status = fulfilment_status;
      if (timestampField) updateData[timestampField] = new Date().toISOString();
      
      const { data, error } = await supabase.from('orders').update(updateData).eq('id', id).select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update blocked by Database Security Policies.");
      
      return data[0];
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrder((/** @type {any} */ prev) => ({ ...prev, ...updatedData }));
    },
    onError: (err) => alert("Failed to update status: " + err.message)
  });

  // 3. Proof Upload Mutation
  const uploadProofMutation = useMutation({
    mutationFn: async (/** @type {{ file: File, type: 'internal' | 'delivery', orderId: string }} */ { file, type, orderId }) => {
      const prefix = type === 'internal' ? 'packed' : 'delivered';
      const fieldToUpdate = type === 'internal' ? 'internal_proof_url' : 'delivery_proof_url';
      
      const fileUrl = await uploadProofFileToSupabase(file, prefix, orderId);
      
      const { data, error } = await supabase.from('orders').update({ [fieldToUpdate]: fileUrl }).eq('id', orderId).select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update blocked by Database Security Policies.");
      
      return data[0];
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrder((/** @type {any} */ prev) => ({ ...prev, ...updatedData }));
      setUploadingProof(null);
    },
    onError: (err) => {
      alert("Failed to upload image: " + err.message);
      setUploadingProof(null);
    }
  });

  useEffect(() => { setCurrentPage(1); setSelectedOrderIds([]); }, [fulfilmentFilter, paymentFilter, currencyFilter, searchQuery, dateFrom, dateTo]);

  const filteredOrders = orders.filter((/** @type {any} */ order) => {
    if (fulfilmentFilter !== 'All Fulfilment' && order.fulfilment_status !== fulfilmentFilter) return false;
    if (paymentFilter !== 'All Payment' && order.payment_status !== paymentFilter) return false;
    if (currencyFilter !== 'All Currency') {
      const orderCurrency = (order.currency || 'USD').toUpperCase();
      if (orderCurrency !== currencyFilter.toUpperCase()) return false;
    }
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

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const isAllSelected = filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length;
  const handleSelectAll = (/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => setSelectedOrderIds(e.target.checked ? filteredOrders.map((/** @type {any} */ o) => o.id) : []);
  const handleSelectOne = (/** @type {string} */ id) => setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]);

  const exportToCSV = () => {
    const dataToExport = selectedOrderIds.length > 0 ? filteredOrders.filter((/** @type {any} */ o) => selectedOrderIds.includes(o.id)) : filteredOrders;
    if (dataToExport.length === 0) return alert("No data to export!");
    
    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Location', 'Address', 'Products Ordered', 'Total Quantity', 'Payment Method', 'Currency', 'Payment Status', 'Fulfilment Status', 'Commercial Status', 'Grand Total'];
    
    const rows = dataToExport.map((/** @type {any} */ order) => {
      const addr = order.shipping_address || {};
      const totalQuantity = order.order_items?.reduce((/** @type {number} */ sum, /** @type {any} */ item) => sum + (item.quantity || 1), 0) || 0;
      const productsList = order.order_items?.map((/** @type {any} */ item) => 
        `${item.product_name} (${item.selected_color}/${item.selected_size}) x${item.quantity}`
      ).join(' | ') || 'No items';

      return [ 
        `MA-${order.id.slice(-8).toUpperCase()}`, 
        new Date(order.created_at).toLocaleDateString(), 
        addr.name || 'N/A', 
        addr.phone || 'N/A', 
        addr.province || 'N/A', 
        addr.address || 'N/A', 
        productsList,
        totalQuantity, 
        order.payment_method === 'qr' ? 'Bank / QR' : order.payment_method, 
        order.currency || 'USD',
        order.payment_status,
        order.fulfilment_status,
        order.commercial_status,
        order.grand_total || 0 
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const openViewModal = (/** @type {any} */ order) => { setSelectedOrder(order); setIsViewModalOpen(true); };
  const closeModals = () => { setIsViewModalOpen(false); setPrintMode(null); setTimeout(() => setSelectedOrder(null), 200); };
  
  const handlePrint = (/** @type {any} */ order, /** @type {'label' | 'receipt'} */ mode) => {
    setSelectedOrder(order);
    setPrintMode(mode);
    setTimeout(() => window.print(), 100);
  };

  const formatDateTime = (/** @type {string} */ isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleProofUpload = async (/** @type {React.ChangeEvent<HTMLInputElement>} */ e, /** @type {'internal' | 'delivery'} */ type) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;
    setUploadingProof(type);
    uploadProofMutation.mutate({ file, type, orderId: selectedOrder.id });
  };

  // STRICT MULTI-DIMENSIONAL WORKFLOW
  const advanceStatus = (/** @type {string} */ action) => {
    if (!selectedOrder) return;
    
    if (action === 'approve_payment') {
      updateStatusMutation.mutate({ 
        id: selectedOrder.id, 
        payment_status: 'Paid', 
        fulfilment_status: 'Picking' 
      });
    }
    else if (action === 'mark_packed') { 
      if (!selectedOrder.internal_proof_url) {
        alert("Please upload the Internal Proof (Packed) photo before marking this order as packed."); return;
      }
      updateStatusMutation.mutate({ 
        id: selectedOrder.id, 
        fulfilment_status: 'Packed', 
        timestampField: 'packed_at' 
      });
    }
    else if (action === 'mark_shipped') { 
      updateStatusMutation.mutate({ 
        id: selectedOrder.id, 
        fulfilment_status: 'Shipped / Out for Delivery', 
        timestampField: 'shipped_at' 
      });
    }
    else if (action === 'mark_delivered') { 
      if (!selectedOrder.delivery_proof_url) {
        alert("Please upload the Delivery Proof (Public) photo before marking this order as delivered."); return;
      }
      updateStatusMutation.mutate({ 
        id: selectedOrder.id, 
        fulfilment_status: 'Delivered', 
        timestampField: 'delivered_at' 
      });
    }
  };

  return (
    <>
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)] print:hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            
            <select value={fulfilmentFilter} onChange={(e) => setFulfilmentFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
              <option>All Fulfilment</option>
              <option value="Unconfirmed">Unconfirmed</option>
              <option value="Picking">Picking</option>
              <option value="Packed">Packed</option>
              <option value="Shipped / Out for Delivery">Shipped / Out for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Returned">Returned</option>
            </select>

            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
              <option>All Payment</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Paid">Paid</option>
              <option value="Refunded">Refunded</option>
            </select>

            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
              <option value="All Currency">All Currency</option>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </select>

            <div className="flex items-center border border-slate-300 rounded bg-white px-3">
              <span className="text-xs text-slate-400 mr-2">From</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none text-slate-600 cursor-pointer" />
              <span className="text-xs text-slate-400 mx-3">—</span>
              <span className="text-xs text-slate-400 mr-2">To</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none text-slate-600 cursor-pointer" />
            </div>
            
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ID, name, phone, or address..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-[250px] md:w-[350px] outline-none focus:border-slate-500" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { queryClient.invalidateQueries({ queryKey: ['admin-orders'] }); refetch(); }} 
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors"
            >
              <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
              <Download size={14} /> Export Excel {selectedOrderIds.length > 0 && `(${selectedOrderIds.length})`}
            </button>
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-10"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-slate-300 cursor-pointer" /></th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer Info</th>
                <th className="px-4 py-3">Shipping To</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading orders...</td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No orders found matching the filter.</td></tr>
              ) : (
                paginatedOrders.map((/** @type {any} */ order) => {
                  const addr = order.shipping_address || {};
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <tr key={order.id} className={`hover:bg-slate-50/50 ${isSelected ? "bg-slate-50" : ""}`}>
                      <td className="px-4 py-4"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(order.id)} className="rounded border-slate-300 cursor-pointer" /></td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">MA-{order.id.slice(-8).toUpperCase()}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(order.created_at)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800">{addr.name || 'N/A'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{addr.phone || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800">{addr.province || 'N/A'}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[150px]">{addr.address || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800 text-xs uppercase font-semibold">{order.payment_method === 'qr' ? 'Bank Transfer' : order.payment_method}</div>
                        <div className="flex gap-1 mt-1">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">{order.currency || 'USD'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                            order.fulfilment_status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            order.fulfilment_status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            order.fulfilment_status === 'Shipped / Out for Delivery' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            order.fulfilment_status === 'Packed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            order.fulfilment_status === 'Picking' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {order.fulfilment_status || 'Unconfirmed'}
                          </span>
                          <span className={`text-[10px] font-bold uppercase ${
                            order.payment_status === 'Paid' ? 'text-emerald-600' : 
                            order.payment_status === 'Refunded' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            Pay: {order.payment_status || 'Unpaid'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2 text-slate-400">
                          <button title="Print Shipping Label" onClick={() => handlePrint(order, 'label')} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded"><Printer size={16} /></button>
                          <button title="View Order Details" onClick={() => openViewModal(order)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded bg-slate-100"><Eye size={16} className="text-slate-600" /></button>
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
          <div className="text-sm text-slate-500">Showing {filteredOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} entries</div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /> Previous</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next <ChevronRight size={16} /></button>
          </div>
        </div>

        {/* --- ADVANCED DETAIL VIEW MODAL --- */}
        {isViewModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-display font-bold text-slate-900">ORDER #MA-{selectedOrder.id.slice(-8).toUpperCase()}</h2>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-200 border border-slate-300 px-3 py-1 rounded-full">
                    {selectedOrder.commercial_status}
                  </span>
                  <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Placed on {formatDateTime(selectedOrder.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handlePrint(selectedOrder, 'label')} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors">
                    <Printer size={16} /> Print Label
                  </button>
                  <button onClick={() => handlePrint(selectedOrder, 'receipt')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-700 transition-colors">
                    <FileText size={16} /> Print Receipt
                  </button>
                  <button onClick={closeModals} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={16} /> Back to List
                  </button>
                </div>
              </div>

              {/* Modal Body Content - 2 Column Grid */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Details & Proofs */}
                <div className="space-y-6">
                  
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><User size={16} className="text-slate-500" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Customer Details</span></div>
                    <div className="p-4 space-y-1">
                      <p className="font-semibold text-slate-900">{selectedOrder.shipping_address?.name}</p>
                      <p className="text-sm text-slate-600">Tel: {selectedOrder.shipping_address?.phone}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.email}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><MapPin size={16} className="text-slate-500" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Shipping Address</span></div>
                    <div className="p-4 space-y-1">
                      <p className="font-semibold text-slate-900">{selectedOrder.shipping_address?.name}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.phone}</p>
                      <p className="text-sm text-slate-600 mt-2">{selectedOrder.shipping_address?.address}</p>
                      <p className="text-sm text-slate-600">{selectedOrder.shipping_address?.province}, Cambodia</p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><CreditCard size={16} className="text-slate-500" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Details</span></div>
                    <div className="p-4 space-y-4">
                      <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Payment Method</p><p className="text-sm font-semibold text-slate-900 uppercase">{selectedOrder.payment_method === 'qr' ? 'Bank Transfer (QR)' : 'Cash on Delivery'}</p></div>
                      <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Currency</p><p className="text-sm font-bold text-slate-900 uppercase">{selectedOrder.currency || 'USD'}</p></div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Payment Status</p>
                        <span className={`inline-block px-2 py-0.5 border rounded text-xs font-semibold ${selectedOrder.payment_status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {selectedOrder.payment_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Payment Receipt Viewer */}
                  {selectedOrder.payment_method === 'qr' && (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <CreditCard size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Customer Receipt</span>
                      </div>
                      <div className="p-4 text-center">
                        {selectedOrder.transaction_receipt_url ? (
                          <a href={selectedOrder.transaction_receipt_url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity bg-slate-50 p-2">
                            <img src={selectedOrder.transaction_receipt_url} alt="Payment Receipt" className="w-full object-contain max-h-48 rounded" />
                            <div className="text-[10px] font-medium text-slate-500 mt-2 pb-1">Click to view full size</div>
                          </a>
                        ) : (
                          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 bg-slate-50 flex flex-col items-center">
                            <AlertTriangle size={24} className="text-amber-400 mb-2" />
                            <p className="text-sm font-semibold text-slate-700">No receipt uploaded</p>
                            <p className="text-[10px] text-slate-500 mt-1">Customer has not submitted payment proof.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Internal Proof Box */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><Package size={16} className="text-slate-500" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Internal Proof (Packed)</span></div>
                    <div className="p-4 text-center">
                      {selectedOrder.internal_proof_url ? (
                        <div className="rounded-lg overflow-hidden border border-slate-200 mb-2"><img src={selectedOrder.internal_proof_url} alt="Internal Proof" className="w-full object-contain" /></div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 mb-2 bg-slate-50 flex flex-col items-center">
                          <Camera size={24} className="text-slate-300 mb-2" />
                          <p className="text-sm font-semibold text-slate-700">No internal proof</p>
                          <p className="text-[10px] text-slate-500 mt-1">For internal use only.</p>
                        </div>
                      )}
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={(e) => handleProofUpload(e, 'internal')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploadingProof === 'internal'} />
                        <button disabled={uploadingProof === 'internal'} className="text-xs font-medium border border-slate-300 bg-white text-slate-700 px-4 py-2 rounded hover:bg-slate-50 w-full disabled:opacity-50">
                          {uploadingProof === 'internal' ? 'Uploading...' : selectedOrder.internal_proof_url ? 'Update Photo' : 'Upload Photo'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Proof Box */}
                  <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
                    <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2"><Truck size={16} className="text-emerald-600" /><span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Delivery Proof (Public)</span></div>
                    <div className="p-4 text-center">
                      {selectedOrder.delivery_proof_url ? (
                        <div className="rounded-lg overflow-hidden border border-slate-200 mb-2"><img src={selectedOrder.delivery_proof_url} alt="Delivery Proof" className="w-full object-contain" /></div>
                      ) : (
                        <div className="border-2 border-dashed border-emerald-100 rounded-lg p-6 mb-2 bg-emerald-50/50 flex flex-col items-center">
                          <Camera size={24} className="text-emerald-300 mb-2" />
                          <p className="text-sm font-semibold text-slate-700">No delivery proof</p>
                          <p className="text-[10px] text-slate-500 mt-1">Visible to customer in history.</p>
                        </div>
                      )}
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={(e) => handleProofUpload(e, 'delivery')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploadingProof === 'delivery'} />
                        <button disabled={uploadingProof === 'delivery'} className="text-xs font-medium border border-emerald-200 bg-white text-emerald-700 px-4 py-2 rounded hover:bg-emerald-50 w-full disabled:opacity-50">
                          {uploadingProof === 'delivery' ? 'Uploading...' : selectedOrder.delivery_proof_url ? 'Update Photo' : 'Upload Photo'}
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Column: Products & Timeline */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Products Table */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Product Details</h3></div>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase">Product</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase">Color/Size</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase text-center">Qty</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Price</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                          selectedOrder.order_items.map((/** @type {any} */ item) => (
                            <tr key={item.id}>
                              <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0"><Package size={14} className="text-slate-400"/></div>
                                {item.product_name}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500 uppercase">{item.selected_color} · {item.selected_size}</td>
                              <td className="px-6 py-4 text-center font-medium text-slate-700">{item.quantity}</td>
                              <td className="px-6 py-4 text-right text-slate-600">${item.unit_price?.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900">${item.total_price?.toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500 bg-slate-50">
                              <p className="font-semibold text-sm">No items found for this order.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    
                    <div className="bg-slate-50 p-6 flex flex-col items-end gap-2 border-t border-slate-200">
                      <div className="w-full max-w-sm flex justify-between text-sm text-slate-600"><span>Sub Total</span><span>${selectedOrder.subtotal?.toFixed(2)}</span></div>
                      <div className="w-full max-w-sm flex justify-between text-sm text-slate-600"><span>Shipping Fees</span><span>{selectedOrder.shipping_fee === 0 ? 'Free' : `$${selectedOrder.shipping_fee?.toFixed(2)}`}</span></div>
                      {selectedOrder.tax > 0 && <div className="w-full max-w-sm flex justify-between text-sm text-slate-600"><span>Tax</span><span>${selectedOrder.tax?.toFixed(2)}</span></div>}
                      <div className="w-full max-w-sm flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200 mt-1"><span>Total</span><span>{selectedOrder.currency === 'KHR' ? `${selectedOrder.grand_total?.toLocaleString()} ៛` : `$${selectedOrder.grand_total?.toFixed(2)}`}</span></div>
                    </div>
                  </div>

                  {/* STRICT 3-DIMENSIONAL WORKFLOW */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Operations Workflow</h3>
                    </div>
                    
                    <div className="p-8">
                      <div className="relative border-l-2 border-slate-200 ml-4 space-y-10 pb-4">
                        
                        {/* 1. Payment Verification */}
                        <div className="relative pl-8">
                          <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.payment_status === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}><CreditCard size={14} /></div>
                          <div>
                            <h4 className={`font-bold ${selectedOrder.payment_status === 'Paid' ? 'text-emerald-700' : 'text-amber-600'}`}>
                              {selectedOrder.payment_status === 'Paid' ? 'PAYMENT VERIFIED' : 'PENDING VERIFICATION'}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">Order Placed: {formatDateTime(selectedOrder.created_at)}</p>
                            
                            {(selectedOrder.payment_status === 'Unpaid' || selectedOrder.payment_status === 'Pending Verification') && (
                              <div className="mt-4">
                                {!selectedOrder.transaction_receipt_url && selectedOrder.payment_method === 'qr' && (
                                  <p className="text-[10px] text-amber-600 font-semibold mb-2 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> Awaiting customer receipt upload
                                  </p>
                                )}
                                <button 
                                  onClick={() => advanceStatus('approve_payment')} 
                                  disabled={updateStatusMutation.isPending || (!selectedOrder.transaction_receipt_url && selectedOrder.payment_method === 'qr')} 
                                  className="text-xs bg-amber-500 text-white px-5 py-2 rounded shadow-sm hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {updateStatusMutation.isPending ? 'Updating...' : 'Approve Payment'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. Picking / Packing */}
                        <div className={`relative pl-8 ${selectedOrder.payment_status !== 'Paid' ? 'opacity-40' : ''}`}>
                          <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.fulfilment_status === 'Picking' ? 'bg-indigo-500 text-white shadow-indigo-200' : (selectedOrder.fulfilment_status !== 'Unconfirmed' ? 'bg-slate-800 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400')}`}><Package size={14} /></div>
                          <div>
                            <h4 className={`font-bold ${selectedOrder.fulfilment_status === 'Picking' ? 'text-indigo-600' : (selectedOrder.fulfilment_status !== 'Unconfirmed' ? 'text-slate-900' : 'text-slate-500')}`}>
                              PROCESSING (Picking Order)
                            </h4>
                            
                            {selectedOrder.fulfilment_status === 'Picking' && (
                              <div className="mt-4">
                                {!selectedOrder.internal_proof_url && (
                                  <p className="text-[10px] text-destructive font-semibold mb-2 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> Upload Internal Proof photo to proceed
                                  </p>
                                )}
                                <button 
                                  onClick={() => advanceStatus('mark_packed')} 
                                  disabled={updateStatusMutation.isPending || !selectedOrder.internal_proof_url} 
                                  className="text-xs bg-indigo-500 text-white px-5 py-2 rounded shadow-sm hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Packed'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. Packed */}
                        <div className={`relative pl-8 ${selectedOrder.fulfilment_status === 'Unconfirmed' || selectedOrder.fulfilment_status === 'Picking' ? 'opacity-40' : ''}`}>
                          <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.fulfilment_status === 'Packed' || selectedOrder.fulfilment_status === 'Shipped / Out for Delivery' || selectedOrder.fulfilment_status === 'Delivered' ? 'bg-slate-800 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400'}`}><Package size={14} /></div>
                          <div>
                            <h4 className={`font-bold ${selectedOrder.fulfilment_status === 'Packed' || selectedOrder.fulfilment_status === 'Shipped / Out for Delivery' || selectedOrder.fulfilment_status === 'Delivered' ? 'text-slate-900' : 'text-slate-500'}`}>
                              PACKED (Ready for collection)
                            </h4>
                            {selectedOrder.packed_at && (
                              <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.packed_at)}</p>
                            )}
                            {selectedOrder.fulfilment_status === 'Packed' && (
                              <button onClick={() => advanceStatus('mark_shipped')} disabled={updateStatusMutation.isPending} className="mt-3 text-xs bg-slate-800 text-white px-5 py-2 rounded shadow-sm hover:bg-slate-700 transition-all disabled:opacity-50">
                                {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Shipped'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4. Shipping */}
                        <div className={`relative pl-8 ${selectedOrder.fulfilment_status !== 'Shipped / Out for Delivery' && selectedOrder.fulfilment_status !== 'Delivered' ? 'opacity-40' : ''}`}>
                          <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.fulfilment_status === 'Shipped / Out for Delivery' || selectedOrder.fulfilment_status === 'Delivered' ? 'bg-blue-600 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400'}`}><Truck size={14} /></div>
                          <div>
                            <h4 className={`font-bold ${selectedOrder.fulfilment_status === 'Shipped / Out for Delivery' || selectedOrder.fulfilment_status === 'Delivered' ? 'text-blue-700' : 'text-slate-500'}`}>
                              SHIPPING (Handed to courier)
                            </h4>
                            {selectedOrder.shipped_at && (
                              <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.shipped_at)}</p>
                            )}
                            {selectedOrder.fulfilment_status === 'Shipped / Out for Delivery' && (
                              <div className="mt-4">
                                {!selectedOrder.delivery_proof_url && (
                                  <p className="text-[10px] text-destructive font-semibold mb-2 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> Upload Delivery Proof photo to proceed
                                  </p>
                                )}
                                <button 
                                  onClick={() => advanceStatus('mark_delivered')} 
                                  disabled={updateStatusMutation.isPending || !selectedOrder.delivery_proof_url} 
                                  className="text-xs bg-blue-600 text-white px-5 py-2 rounded shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Delivered'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 5. Delivered */}
                        <div className={`relative pl-8 ${selectedOrder.fulfilment_status !== 'Delivered' ? 'opacity-40' : ''}`}>
                          <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.fulfilment_status === 'Delivered' ? 'bg-emerald-500 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400'}`}><CheckCircle size={14} /></div>
                          <div>
                            <h4 className={`font-bold ${selectedOrder.fulfilment_status === 'Delivered' ? 'text-emerald-600' : 'text-slate-500'}`}>
                              DELIVERED (Completed)
                            </h4>
                            {selectedOrder.delivered_at && (
                              <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.delivered_at)}</p>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {printMode === 'label' && <ShippingLabel order={selectedOrder} />}
      {printMode === 'receipt' && <ReceiptTemplate order={selectedOrder} />}
    </>
  );
}