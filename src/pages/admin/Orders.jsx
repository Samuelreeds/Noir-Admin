import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, Download, Printer, Search, Eye, X, FileText, ChevronLeft, ChevronRight,
  Package, Truck, CheckCircle, Camera, CreditCard, MapPin, User, ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState(/** @type {string[]} */ ([]));

  const [selectedOrder, setSelectedOrder] = useState(/** @type {any} */ (null));
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(/** @type {string | null} */ (null));

  const queryClient = useQueryClient();

  // 1. Fetch live orders
  const { data: orders = [], isLoading: loading, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, payment_method, shipping_address, subtotal, shipping_fee, tax, grand_total,
          packed_at, shipped_at, delivered_at, internal_proof_url, delivery_proof_url, transaction_reference,
          order_items ( id, product_name, unit_price, quantity, selected_size, selected_color, total_price )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Status Update Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (/** @type {{ id: string, newStatus: string, timestampField: string }} */ { id, newStatus, timestampField }) => {
      const updateData = { status: newStatus, [timestampField]: new Date().toISOString() };
      const { data, error } = await supabase.from('orders').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      // FIXED: Removed the `: any` TypeScript annotation
      setSelectedOrder((prev) => ({ ...prev, ...updatedData }));
    },
    onError: (err) => alert("Failed to update status: " + err.message)
  });

  // 3. Proof Upload Mutation
  const uploadProofMutation = useMutation({
    mutationFn: async (/** @type {{ file: File, type: 'internal' | 'delivery', orderId: string }} */ { file, type, orderId }) => {
      const prefix = type === 'internal' ? 'packed' : 'delivered';
      const fieldToUpdate = type === 'internal' ? 'internal_proof_url' : 'delivery_proof_url';
      
      const fileUrl = await uploadProofFileToSupabase(file, prefix, orderId);
      
      const { data, error } = await supabase.from('orders').update({ [fieldToUpdate]: fileUrl }).eq('id', orderId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      // FIXED: Removed the `: any` TypeScript annotation
      setSelectedOrder((prev) => ({ ...prev, ...updatedData }));
      setUploadingProof(null);
    },
    onError: (err) => {
      alert("Failed to upload image: " + err.message);
      setUploadingProof(null);
    }
  });

  useEffect(() => { setCurrentPage(1); setSelectedOrderIds([]); }, [statusFilter, searchQuery, dateFrom, dateTo]);

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

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const isAllSelected = filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length;
  const handleSelectAll = (/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => setSelectedOrderIds(e.target.checked ? filteredOrders.map((/** @type {any} */ o) => o.id) : []);
  const handleSelectOne = (/** @type {string} */ id) => setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]);

  const exportToCSV = () => {
    const dataToExport = selectedOrderIds.length > 0 ? filteredOrders.filter((/** @type {any} */ o) => selectedOrderIds.includes(o.id)) : filteredOrders;
    if (dataToExport.length === 0) return alert("No data to export!");
    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Location', 'Address', 'Total Items', 'Payment', 'Status', 'Grand Total'];
    const rows = dataToExport.map((/** @type {any} */ order) => {
      const addr = order.shipping_address || {};
      return [ `MA-${order.id.slice(-8).toUpperCase()}`, new Date(order.created_at).toLocaleDateString(), addr.name || 'N/A', addr.phone || 'N/A', addr.province || 'N/A', addr.address || 'N/A', order.order_items?.length || 0, order.payment_method === 'qr' ? 'Bank / QR' : order.payment_method, order.status, order.grand_total || 0 ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const openViewModal = (/** @type {any} */ order) => { setSelectedOrder(order); setIsViewModalOpen(true); };
  const closeModals = () => { setIsViewModalOpen(false); setIsPrintModalOpen(false); setTimeout(() => setSelectedOrder(null), 200); };
  const executePrint = () => { window.print(); closeModals(); };

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

  const advanceStatus = (/** @type {string} */ currentStatus) => {
    if (!selectedOrder) return;
    let nextStatus = ''; let timestampField = '';
    if (currentStatus === 'pending') { nextStatus = 'packed'; timestampField = 'packed_at'; }
    else if (currentStatus === 'packed') { nextStatus = 'shipping'; timestampField = 'shipped_at'; }
    else if (currentStatus === 'shipping') { nextStatus = 'delivered'; timestampField = 'delivered_at'; }
    if (nextStatus) updateStatusMutation.mutate({ id: selectedOrder.id, newStatus: nextStatus, timestampField });
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
            <option>All Status</option><option value="pending">Pending</option><option value="packed">Packed</option><option value="shipping">Shipping</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
          </select>
          <div className="flex items-center border border-slate-300 rounded bg-white px-3">
            <span className="text-xs text-slate-400 mr-2">From</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none text-slate-600 cursor-pointer" />
            <span className="text-xs text-slate-400 mx-3">—</span>
            <span className="text-xs text-slate-400 mr-2">To</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none text-slate-600 cursor-pointer" />
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ID, name, phone, or address..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-[300px] md:w-[400px] outline-none focus:border-slate-500" />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-3">
           <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors"><RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh</button>
           <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors"><Download size={14} /> Export Excel {selectedOrderIds.length > 0 && `(${selectedOrderIds.length})`}</button>
           <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors"><Printer size={14} /> Print List</button>
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
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading orders...</td></tr>
            ) : paginatedOrders.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No orders found.</td></tr>
            ) : (
              paginatedOrders.map((/** @type {any} */ order) => {
                const addr = order.shipping_address || {};
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <tr key={order.id} className={`hover:bg-slate-50/50 ${isSelected ? "bg-slate-50" : ""}`}>
                    <td className="px-4 py-4"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(order.id)} className="rounded border-slate-300 cursor-pointer" /></td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800">MA-{order.id.slice(-8).toUpperCase()}</div>
                      {/* FIXED: Changed to formatDateTime */}
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
                      {order.payment_method !== 'cod' && <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium mt-1">Paid</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                        order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                        order.status === 'shipping' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        order.status === 'packed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {order.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button onClick={() => { setSelectedOrder(order); setIsPrintModalOpen(true); }} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded"><Printer size={16} /></button>
                        <button onClick={() => openViewModal(order)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded bg-slate-100"><Eye size={16} className="text-slate-600" /></button>
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
                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Placed on {formatDateTime(selectedOrder.created_at)}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsViewModalOpen(false); setIsPrintModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors">
                  <Printer size={16} /> Print Invoice
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

                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><CreditCard size={16} className="text-slate-500" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Details</span></div>
                  <div className="p-4 space-y-4">
                    <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Order Reference</p><p className="text-sm font-semibold text-slate-900">MA-{selectedOrder.id.slice(-8).toUpperCase()}</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Payment Method</p><p className="text-sm font-semibold text-slate-900 uppercase">{selectedOrder.payment_method === 'qr' ? 'Bank Transfer (QR)' : 'Cash on Delivery'}</p></div>
                    {selectedOrder.transaction_reference && <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Bank Ref</p><p className="text-sm font-mono text-slate-600">{selectedOrder.transaction_reference}</p></div>}
                    <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Status</p><span className="inline-block px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-semibold">{selectedOrder.payment_method === 'cod' ? 'Pending COD' : 'Paid'}</span></div>
                  </div>
                </div>

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
                      {selectedOrder.order_items?.map((/** @type {any} */ item) => (
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
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="bg-slate-50 p-6 flex flex-col items-end gap-2 border-t border-slate-200">
                    <div className="w-full max-w-sm flex justify-between text-sm text-slate-600"><span>Sub Total</span><span>${selectedOrder.subtotal?.toFixed(2)}</span></div>
                    <div className="w-full max-w-sm flex justify-between text-sm text-slate-600"><span>Shipping Fees</span><span>{selectedOrder.shipping_fee === 0 ? 'Free' : `$${selectedOrder.shipping_fee?.toFixed(2)}`}</span></div>
                    {selectedOrder.tax > 0 && <div className="w-full max-w-sm flex justify-between text-sm text-slate-600"><span>Tax</span><span>${selectedOrder.tax?.toFixed(2)}</span></div>}
                    <div className="w-full max-w-sm flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200 mt-1"><span>Total</span><span>${selectedOrder.grand_total?.toFixed(2)}</span></div>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Order Status</h3>
                  </div>
                  
                  <div className="p-8">
                    <div className="relative border-l-2 border-slate-200 ml-4 space-y-10 pb-4">
                      
                      {/* 1. Pending */}
                      <div className="relative pl-8">
                        <div className="absolute -left-[17px] top-0 bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white]"><Package size={14} /></div>
                        <div>
                          <h4 className="font-bold text-slate-900">PROCESSING (Pending)</h4>
                          <p className="text-sm text-slate-500 mt-1">Order Placed</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.created_at)}</p>
                          {selectedOrder.status === 'pending' && (
                            <button onClick={() => advanceStatus('pending')} disabled={updateStatusMutation.isPending} className="mt-3 text-xs bg-slate-800 text-white px-4 py-1.5 rounded hover:bg-slate-700 transition-colors disabled:opacity-50">
                              {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Packed'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 2. Packed */}
                      <div className={`relative pl-8 ${!selectedOrder.packed_at && selectedOrder.status !== 'packed' && selectedOrder.status !== 'shipping' && selectedOrder.status !== 'delivered' ? 'opacity-40' : ''}`}>
                        <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.packed_at ? 'bg-slate-800 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400'}`}><Package size={14} /></div>
                        <div>
                          <h4 className={`font-bold ${selectedOrder.packed_at ? 'text-slate-900' : 'text-slate-500'}`}>PACKED (Ready for collection)</h4>
                          {selectedOrder.packed_at && (
                            <>
                              <p className="text-sm text-slate-500 mt-1">Status updated from PROCESSING to PACKED</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.packed_at)}</p>
                            </>
                          )}
                          {selectedOrder.status === 'packed' && (
                            <button onClick={() => advanceStatus('packed')} disabled={updateStatusMutation.isPending} className="mt-3 text-xs bg-slate-800 text-white px-4 py-1.5 rounded hover:bg-slate-700 transition-colors disabled:opacity-50">
                              {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Shipped'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 3. Shipping */}
                      <div className={`relative pl-8 ${!selectedOrder.shipped_at && selectedOrder.status !== 'shipping' && selectedOrder.status !== 'delivered' ? 'opacity-40' : ''}`}>
                        <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.shipped_at ? 'bg-blue-600 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400'}`}><Truck size={14} /></div>
                        <div>
                          <h4 className={`font-bold ${selectedOrder.shipped_at ? 'text-blue-700' : 'text-slate-500'}`}>SHIPPING (Handed to courier)</h4>
                          {selectedOrder.shipped_at && (
                            <>
                              <p className="text-sm text-slate-500 mt-1">Status updated from PACKED to SHIPPING</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.shipped_at)}</p>
                            </>
                          )}
                          {selectedOrder.status === 'shipping' && (
                            <button onClick={() => advanceStatus('shipping')} disabled={updateStatusMutation.isPending} className="mt-3 text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
                              {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Delivered'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 4. Delivered */}
                      <div className={`relative pl-8 ${!selectedOrder.delivered_at && selectedOrder.status !== 'delivered' ? 'opacity-40' : ''}`}>
                        <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_4px_white] ${selectedOrder.delivered_at ? 'bg-emerald-500 text-white' : 'bg-slate-100 border border-slate-300 text-slate-400'}`}><CheckCircle size={14} /></div>
                        <div>
                          <h4 className={`font-bold ${selectedOrder.delivered_at ? 'text-emerald-600' : 'text-slate-500'}`}>DELIVERED (Completed)</h4>
                          {selectedOrder.delivered_at && (
                            <>
                              <p className="text-sm text-slate-500 mt-1">Status updated from SHIPPING to DELIVERED</p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.delivered_at)}</p>
                            </>
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

      {/* Print Overlay... (Unchanged from original) */}
      {isPrintModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
             <h2 className="text-lg font-semibold text-slate-900 mb-1">Print Document</h2>
             <button onClick={executePrint} className="w-full mt-4 bg-slate-800 text-white py-2 rounded">Print</button>
             <button onClick={closeModals} className="w-full mt-2 text-slate-500 py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}