// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, Download, Printer, Search, Eye, X, FileText, ChevronLeft, ChevronRight,
  Package, Truck, CheckCircle, Camera, CreditCard, MapPin, User, ArrowLeft, AlertTriangle, RefreshCcwDot, XCircle, RotateCcw, FileMinus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ShippingLabel from '@/components/admin/ShippingLabel';
import ReceiptTemplate from '@/components/admin/ReceiptTemplate';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const ITEMS_PER_PAGE = 20;

const uploadProofFileToSupabase = async (/** @type {File} */ file, /** @type {string} */ prefix, /** @type {string} */ orderId) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${prefix}_${orderId}_${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('order-proofs').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('order-proofs').getPublicUrl(fileName);
  return data.publicUrl;
};

const generateIdempotencyKey = () => `ret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const generateInvoicePDF = (/** @type {any} */ order) => {
  const formatPrice = (/** @type {number} */ val) => order.currency === 'KHR' ? `${val.toLocaleString()} KHR` : `$${val.toFixed(2)}`;
  const isPaid = ['Paid', 'Refunded', 'Partially Refunded'].includes(order.payment_status);
  const amountPaid = isPaid ? order.grand_total : 0;
  const amountDue = isPaid ? 0 : order.grand_total;

  const doc = new jsPDF();
  
  doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.text("NOIR MTD CO., LTD.", 14, 22);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("TAX INVOICE", 195, 22, { align: "right" });
  
  doc.setTextColor(0);
  doc.text(`Invoice No: ${order.invoice_number || 'N/A'}`, 14, 34);
  doc.text(`Order Ref: MA-${order.id.slice(-8).toUpperCase()}`, 14, 40);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 14, 46);
  doc.text(`Payment: ${order.payment_method === 'qr' ? 'Bank Transfer' : 'Cash on Delivery'}`, 14, 52);
  
  doc.setFont("helvetica", "bold"); doc.text("Billed To:", 120, 34);
  doc.setFont("helvetica", "normal");
  doc.text(order.shipping_address?.name || "N/A", 120, 40);
  doc.text(order.shipping_address?.phone || "N/A", 120, 46);
  doc.text(order.shipping_address?.address || "N/A", 120, 52);
  doc.text(`${order.shipping_address?.province || "N/A"}, Cambodia`, 120, 58);
  
  const tableData = order.order_items.map((/** @type {any} */ item) => [
    item.product_name, `${item.selected_color} / ${item.selected_size}`, item.quantity.toString(), formatPrice(item.unit_price), formatPrice(item.total_price)
  ]);

  autoTable(doc, {
    startY: 70, head: [['Product', 'Variant', 'Qty', 'Unit Price', 'Total']], body: tableData, theme: 'plain',
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 }, alternateRowStyles: { fillColor: [248, 248, 248] }
  });

  const finalY = (/** @type {any} */ (doc)).lastAutoTable.finalY + 12;
  
  doc.text(`Subtotal:`, 140, finalY); doc.text(formatPrice(order.subtotal || 0), 195, finalY, { align: "right" });
  doc.text(`Shipping:`, 140, finalY + 8); doc.text(formatPrice(order.shipping_fee || 0), 195, finalY + 8, { align: "right" });
  
  if (order.tax > 0) {
    doc.text(`Tax:`, 140, finalY + 16); doc.text(formatPrice(order.tax), 195, finalY + 16, { align: "right" });
  }
  
  const totalY = finalY + (order.tax > 0 ? 26 : 18);
  doc.setFont("helvetica", "bold");
  doc.text(`Grand Total:`, 140, totalY); doc.text(formatPrice(order.grand_total), 195, totalY, { align: "right" });
  
  doc.text(`Amount Paid:`, 140, totalY + 10); doc.text(formatPrice(amountPaid), 195, totalY + 10, { align: "right" });
  doc.text(`Amount Due:`, 140, totalY + 18); doc.text(formatPrice(amountDue), 195, totalY + 18, { align: "right" });

  doc.save(`${order.invoice_number || 'Invoice'}.pdf`);
};

const generateCreditNotePDF = (/** @type {any} */ order, /** @type {any} */ returnRecord) => {
  const formatPrice = (/** @type {number} */ val) => order.currency === 'KHR' ? `${val.toLocaleString()} KHR` : `$${val.toFixed(2)}`;
  const item = order.order_items.find((/** @type {any} */ i) => i.id === returnRecord.order_item_id);
  const refundValue = item.unit_price * returnRecord.quantity;

  const doc = new jsPDF();
  
  doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.text("NOIR MTD CO., LTD.", 14, 22);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("CREDIT NOTE", 195, 22, { align: "right" });
  
  doc.setTextColor(0);
  doc.text(`Credit Note No: ${returnRecord.credit_note_number || 'N/A'}`, 14, 34);
  doc.text(`Original Invoice: ${order.invoice_number || 'N/A'}`, 14, 40);
  doc.text(`Date Issued: ${new Date(returnRecord.created_at).toLocaleDateString()}`, 14, 46);
  doc.text(`Reason: ${returnRecord.reason || 'Return processed'}`, 14, 52);
  
  doc.setFont("helvetica", "bold"); doc.text("Issued To:", 120, 34);
  doc.setFont("helvetica", "normal");
  doc.text(order.shipping_address?.name || "N/A", 120, 40);
  doc.text(order.shipping_address?.phone || "N/A", 120, 46);
  
  const tableData = [[
    item.product_name, `${item.selected_color} / ${item.selected_size}`, returnRecord.quantity.toString(), formatPrice(item.unit_price), formatPrice(refundValue)
  ]];

  autoTable(doc, {
    startY: 65, head: [['Product Returned', 'Variant', 'Qty', 'Unit Price', 'Credit Amount']], body: tableData, theme: 'plain',
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 }, alternateRowStyles: { fillColor: [248, 248, 248] }
  });

  const finalY = (/** @type {any} */ (doc)).lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Credit / Refund Value:`, 110, finalY); doc.text(formatPrice(refundValue), 195, finalY, { align: "right" });

  doc.save(`${returnRecord.credit_note_number || 'Credit_Note'}.pdf`);
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

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState(/** @type {any} */ (null));
  const [returnForm, setReturnForm] = useState({ quantity: 1, condition: 'Sellable', warehouse: 'Main Warehouse', batch_lot: '', reason: '' });

  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ courier_name: '', tracking_number: '' });
  const [isFailModalOpen, setIsFailModalOpen] = useState(false);
  const [failForm, setFailForm] = useState({ reason: '' });

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading: loading, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, payment_status, fulfilment_status, commercial_status, invoice_number,
          payment_method, shipping_address, subtotal, shipping_fee, tax, grand_total, currency,
          packed_at, shipped_at, delivered_at, internal_proof_url, delivery_proof_url, transaction_reference, transaction_receipt_url,
          courier_name, tracking_number, failed_delivery_at, failed_delivery_reason,
          order_items ( id, product_name, unit_price, quantity, selected_size, selected_color, total_price ),
          order_returns ( id, order_item_id, quantity, condition, restock_warehouse, status, created_at, credit_note_number, reason )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (/** @type {any} */ payload) => {
      const { id, payment_status, fulfilment_status, commercial_status, timestampField, courier_name, tracking_number, failed_delivery_reason } = payload;
      
      const updateData = {};
      if (payment_status) updateData.payment_status = payment_status;
      if (fulfilment_status) updateData.fulfilment_status = fulfilment_status;
      if (commercial_status) updateData.commercial_status = commercial_status;
      if (timestampField) updateData[timestampField] = new Date().toISOString();
      if (courier_name !== undefined) updateData.courier_name = courier_name;
      if (tracking_number !== undefined) updateData.tracking_number = tracking_number;
      if (failed_delivery_reason !== undefined) updateData.failed_delivery_reason = failed_delivery_reason;
      
      const { data, error } = await supabase.from('orders').update(updateData).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrder((/** @type {any} */ prev) => ({ ...prev, ...updatedData }));
      setIsShipModalOpen(false);
      setIsFailModalOpen(false);
    },
    onError: (err) => alert(err.message) 
  });

  const uploadProofMutation = useMutation({
    mutationFn: async (/** @type {{ file: File, type: 'internal' | 'delivery', orderId: string }} */ { file, type, orderId }) => {
      const prefix = type === 'internal' ? 'packed' : 'delivered';
      const fieldToUpdate = type === 'internal' ? 'internal_proof_url' : 'delivery_proof_url';
      const fileUrl = await uploadProofFileToSupabase(file, prefix, orderId);
      const { data, error } = await supabase.from('orders').update({ [fieldToUpdate]: fileUrl }).eq('id', orderId).select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedOrder((/** @type {any} */ prev) => ({ ...prev, ...updatedData }));
      setUploadingProof(null);
    },
    onError: (err) => { alert("Failed to upload image: " + err.message); setUploadingProof(null); }
  });

  const processReturnMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReturnItem || returnForm.quantity <= 0) throw new Error("Invalid return quantity.");
      const { error } = await supabase.rpc('process_return_and_restock', {
        p_order_id: selectedOrder.id, p_order_item_id: selectedReturnItem.item.id, p_quantity: returnForm.quantity,
        p_reason: returnForm.reason, p_condition: returnForm.condition, p_warehouse: returnForm.warehouse,
        p_batch_lot: returnForm.batch_lot || null, p_idempotency_key: generateIdempotencyKey()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setIsReturnModalOpen(false);
      setIsViewModalOpen(false); 
      setTimeout(() => alert("Return and Restock processed successfully!"), 300);
    },
    onError: (err) => alert("Failed to process return: " + err.message)
  });

  // Export handling logic: Bypasses pagination and uses RPC if no specific rows are selected
  const exportAllOrdersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('export_all_orders');
      if (error) throw error;
      return data;
    },
    onSuccess: (serverData) => processCSVExport(serverData, 'FULL_DATABASE'),
    onError: (err) => alert("Export failed: " + err.message)
  });

  const processCSVExport = (/** @type {any[]} */ dataToExport, /** @type {string} */ prefix) => {
    if (!dataToExport || dataToExport.length === 0) return alert("No data to export!");
    
    const headers = ['Invoice No', 'Order ID', 'Date', 'Customer Name', 'Phone', 'Location', 'Address', 'Products Ordered', 'Total Quantity', 'Payment Method', 'Currency', 'Payment Status', 'Fulfilment Status', 'Courier', 'Tracking Number', 'Commercial Status', 'Grand Total'];
    
    const rows = dataToExport.map((/** @type {any} */ order) => {
      const addr = order.shipping_address || {};
      const totalQuantity = order.order_items?.reduce((/** @type {number} */ sum, /** @type {any} */ item) => sum + (item.quantity || 1), 0) || 0;
      const productsList = order.order_items?.map((/** @type {any} */ item) => `${item.product_name} (${item.selected_color}/${item.selected_size}) x${item.quantity}`).join(' | ') || 'No items';

      return [ 
        order.invoice_number || 'N/A', `MA-${order.id.slice(-8).toUpperCase()}`, new Date(order.created_at).toLocaleDateString(), 
        addr.name || 'N/A', addr.phone || 'N/A', addr.province || 'N/A', addr.address || 'N/A', 
        productsList, totalQuantity, order.payment_method === 'qr' ? 'Bank / QR' : order.payment_method, 
        order.currency || 'USD', order.payment_status, order.fulfilment_status,
        order.courier_name || 'N/A', order.tracking_number || 'N/A',
        order.commercial_status, order.grand_total || 0 
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `orders_export_${prefix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExport = () => {
    if (selectedOrderIds.length > 0) {
      processCSVExport(orders.filter((/** @type {any} */ o) => selectedOrderIds.includes(o.id)), 'SELECTED');
    } else {
      exportAllOrdersMutation.mutate();
    }
  };

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
      const searchString = `${order.id} ${addr.name || ''} ${addr.phone || ''} ${addr.address || ''} ${addr.province || ''} ${order.tracking_number || ''} ${order.invoice_number || ''}`.toLowerCase();
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

  const openViewModal = (/** @type {any} */ order) => { setSelectedOrder(order); setIsViewModalOpen(true); };
  const closeModals = () => { setIsViewModalOpen(false); setPrintMode(null); setTimeout(() => setSelectedOrder(null), 200); };
  const handlePrint = (/** @type {any} */ order, /** @type {'label' | 'receipt'} */ mode) => { setSelectedOrder(order); setPrintMode(mode); setTimeout(() => window.print(), 100); };
  const formatDateTime = (/** @type {string} */ isoString) => { if (!isoString) return ''; return new Date(isoString).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }); };
  const handleProofUpload = async (/** @type {React.ChangeEvent<HTMLInputElement>} */ e, /** @type {'internal' | 'delivery'} */ type) => { const file = e.target.files?.[0]; if (!file || !selectedOrder) return; setUploadingProof(type); uploadProofMutation.mutate({ file, type, orderId: selectedOrder.id }); };

  const advanceStatus = (/** @type {string} */ action) => {
    if (!selectedOrder) return;
    
    if (action === 'approve_payment') updateStatusMutation.mutate({ id: selectedOrder.id, payment_status: 'Paid' });
    else if (action === 'reject_payment') { if (window.confirm("Are you sure you want to REJECT this payment?")) updateStatusMutation.mutate({ id: selectedOrder.id, payment_status: 'Failed' }); }
    else if (action === 'mark_picking') updateStatusMutation.mutate({ id: selectedOrder.id, fulfilment_status: 'Picking' });
    else if (action === 'mark_packed') { 
      if (!selectedOrder.internal_proof_url) { alert("Upload Internal Proof photo first."); return; }
      updateStatusMutation.mutate({ id: selectedOrder.id, fulfilment_status: 'Packed', timestampField: 'packed_at' });
    }
    else if (action === 'open_ship_modal') {
      setShipForm({ courier_name: selectedOrder.courier_name || '', tracking_number: selectedOrder.tracking_number || '' });
      setIsShipModalOpen(true);
    }
    else if (action === 'open_fail_modal') {
      setFailForm({ reason: '' });
      setIsFailModalOpen(true);
    }
    else if (action === 'retry_shipment') {
      updateStatusMutation.mutate({ id: selectedOrder.id, fulfilment_status: 'Shipped / Out for Delivery', timestampField: 'shipped_at' });
    }
    else if (action === 'mark_delivered') { 
      if (!selectedOrder.delivery_proof_url) { alert("Upload Delivery Proof photo first."); return; }
      updateStatusMutation.mutate({ id: selectedOrder.id, fulfilment_status: 'Delivered', timestampField: 'delivered_at', commercial_status: 'Completed' });
    }
    else if (action === 'process_refund') {
      if (window.confirm("RBAC CHECK: Are you sure you want to refund this order?")) updateStatusMutation.mutate({ id: selectedOrder.id, payment_status: 'Refunded', commercial_status: 'Returned' });
    }
  };

  const openReturnModal = (/** @type {any} */ item, /** @type {number} */ maxQty) => { setSelectedReturnItem({ item, maxQty }); setReturnForm({ quantity: 1, condition: 'Sellable', warehouse: 'Main Warehouse', batch_lot: '', reason: '' }); setIsReturnModalOpen(true); };

  const submitShipping = () => {
    if (!shipForm.courier_name || !shipForm.tracking_number) return alert("Courier Name and Tracking Number are strictly required.");
    updateStatusMutation.mutate({
      id: selectedOrder.id, fulfilment_status: 'Shipped / Out for Delivery', timestampField: 'shipped_at',
      courier_name: shipForm.courier_name, tracking_number: shipForm.tracking_number
    });
  };

  const submitFailedDelivery = () => {
    if (!failForm.reason) return alert("A failure reason is required.");
    updateStatusMutation.mutate({ id: selectedOrder.id, fulfilment_status: 'Failed Delivery', failed_delivery_reason: failForm.reason });
  };

  return (
    <>
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)] print:hidden">
        
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={fulfilmentFilter} onChange={(e) => setFulfilmentFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
              <option>All Fulfilment</option>
              <option value="Unconfirmed">Unconfirmed</option>
              <option value="Picking">Picking</option>
              <option value="Packed">Packed</option>
              <option value="Shipped / Out for Delivery">Shipped / Out for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Failed Delivery">Failed Delivery</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Returned">Returned</option>
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer">
              <option>All Payment</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Paid">Paid</option>
              <option value="Failed">Failed</option>
              <option value="Partially Refunded">Partially Refunded</option>
              <option value="Refunded">Refunded</option>
            </select>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Invoice No, ID, or name..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-[250px] outline-none focus:border-slate-500" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['admin-orders'] }); refetch(); }} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
              <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={handleExport} disabled={exportAllOrdersMutation.isPending} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors disabled:opacity-50">
              {exportAllOrdersMutation.isPending ? <RefreshCcw size={14} className="animate-spin" /> : <Download size={14} />} 
              {selectedOrderIds.length > 0 ? `Export Selected (${selectedOrderIds.length})` : 'Export All Database Records'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-10"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-slate-300 cursor-pointer" /></th>
                <th className="px-4 py-3">Invoice & Order</th>
                <th className="px-4 py-3">Customer Info</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading orders...</td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No orders found matching the filter.</td></tr>
              ) : (
                paginatedOrders.map((/** @type {any} */ order) => {
                  const addr = order.shipping_address || {};
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <tr key={order.id} className={`hover:bg-slate-50/50 ${isSelected ? "bg-slate-50" : ""}`}>
                      <td className="px-4 py-4"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(order.id)} className="rounded border-slate-300 cursor-pointer" /></td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900">{order.invoice_number || 'Pending'}</div>
                        <div className="font-medium text-slate-500 text-xs mt-0.5">MA-{order.id.slice(-8).toUpperCase()}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(order.created_at)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800">{addr.name || 'N/A'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{addr.phone || 'N/A'}</div>
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
                            order.commercial_status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200' :
                            order.fulfilment_status === 'Failed Delivery' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            order.fulfilment_status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {order.commercial_status === 'Returned' ? 'RETURNED' : order.fulfilment_status || 'Unconfirmed'}
                          </span>
                          <span className={`text-[10px] font-bold uppercase ${
                            order.payment_status === 'Paid' ? 'text-emerald-600' : 
                            order.payment_status === 'Refunded' || order.payment_status === 'Partially Refunded' ? 'text-red-600' : 
                            order.payment_status === 'Failed' ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                            Pay: {order.payment_status || 'Unpaid'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2 text-slate-400">
                          <button onClick={() => openViewModal(order)} className="p-1.5 hover:text-slate-800 border border-slate-200 rounded bg-slate-50"><Eye size={16} className="text-slate-600" /></button>
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

        {/* --- VIEW MODAL --- */}
        {isViewModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-display font-bold text-slate-900">ORDER #MA-{selectedOrder.id.slice(-8).toUpperCase()}</h2>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-200 border border-slate-300 px-3 py-1 rounded-full">
                    {selectedOrder.commercial_status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => generateInvoicePDF(selectedOrder)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-700 transition-colors">
                    <FileText size={16} /> Invoice: {selectedOrder.invoice_number}
                  </button>
                  <button onClick={closeModals} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors">
                    <ArrowLeft size={16} /> Back
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="space-y-6">
                  {/* Payment Details */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <CreditCard size={16} className="text-slate-500" />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Details</span>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Status</p>
                        <span className={`inline-block px-2 py-0.5 border rounded text-xs font-semibold ${selectedOrder.payment_status.includes('Paid') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : selectedOrder.payment_status.includes('Refund') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {selectedOrder.payment_status}
                        </span>
                      </div>

                      {/* Authoritative Paid / Due Rendering */}
                      {(() => {
                        const isPaid = ['Paid', 'Refunded', 'Partially Refunded'].includes(selectedOrder.payment_status);
                        const format = (v) => selectedOrder.currency === 'KHR' ? `${v.toLocaleString()} KHR` : `$${v.toFixed(2)}`;
                        return (
                          <div className="bg-slate-50 border border-slate-100 rounded p-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 font-medium">Invoice Total:</span>
                              <span className="text-slate-900 font-bold">{format(selectedOrder.grand_total)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-emerald-700">
                              <span className="font-medium">Amount Paid:</span>
                              <span className="font-bold">{isPaid ? format(selectedOrder.grand_total) : format(0)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-rose-600 border-t border-slate-200 pt-2">
                              <span className="font-medium">Amount Due:</span>
                              <span className="font-bold">{isPaid ? format(0) : format(selectedOrder.grand_total)}</span>
                            </div>
                          </div>
                        );
                      })()}
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
                          <a href={selectedOrder.transaction_receipt_url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 bg-slate-50 p-2">
                            <img src={selectedOrder.transaction_receipt_url} alt="Payment Receipt" className="w-full object-contain max-h-48 rounded" />
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-slate-700">No receipt uploaded</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Shipping Details */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <Truck size={16} className="text-slate-500" />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Shipment Details</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {selectedOrder.courier_name ? (
                        <>
                          <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Courier Provider</p><p className="text-sm font-semibold text-slate-900">{selectedOrder.courier_name}</p></div>
                          <div><p className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Tracking Number</p><p className="text-sm font-mono text-slate-900 bg-slate-100 p-2 rounded">{selectedOrder.tracking_number}</p></div>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 italic">No shipment assigned yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Products Table */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Order Items</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase">Product</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase text-center">Qty</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Price</th>
                          <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedOrder.order_items?.map((/** @type {any} */ item) => {
                          const returnedQty = selectedOrder.order_returns?.filter((/** @type {any} */ r) => r.order_item_id === item.id).reduce((/** @type {number} */ sum, /** @type {any} */ r) => sum + r.quantity, 0) || 0;
                          const availableToReturn = item.quantity - returnedQty;

                          return (
                            <tr key={item.id}>
                              <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center shrink-0"><Package size={14} className="text-slate-400"/></div>
                                <div>
                                  <p>{item.product_name}</p>
                                  <p className="text-[10px] text-slate-500 uppercase">{item.selected_color} · {item.selected_size}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center font-medium text-slate-700">
                                {item.quantity}
                                {returnedQty > 0 && <span className="block text-red-600 text-xs font-bold">-{returnedQty} Returned</span>}
                              </td>
                              <td className="px-6 py-4 text-right text-slate-600">${item.total_price?.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right">
                                {availableToReturn > 0 ? (
                                  <button onClick={() => openReturnModal(item, availableToReturn)} className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-200 transition-colors flex items-center gap-1 ml-auto">
                                    <RotateCcw size={12} /> Return
                                  </button>
                                ) : (
                                  <span className="text-xs font-bold uppercase text-slate-400">Fully Returned</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Returns History Box with Credit Note Generator */}
                  {selectedOrder.order_returns?.length > 0 && (
                    <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
                      <div className="px-6 py-3 bg-red-100 border-b border-red-200"><h3 className="text-sm font-bold text-red-800 uppercase tracking-wider">Processed Returns & Credit Notes</h3></div>
                      <div className="p-4 space-y-3">
                        {selectedOrder.order_returns.map((/** @type {any} */ ret) => {
                          const item = selectedOrder.order_items?.find((/** @type {any} */ i) => i.id === ret.order_item_id);
                          return (
                            <div key={ret.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm border-b border-red-200/50 pb-3 last:border-0 last:pb-0">
                              <div>
                                <p className="font-bold text-red-900">{item?.product_name} <span className="text-red-700 font-normal">x{ret.quantity}</span></p>
                                <p className="text-[10px] text-red-600">{new Date(ret.created_at).toLocaleString()} · Condition: {ret.condition}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold uppercase bg-white text-red-700 px-2 py-1 rounded border border-red-200 shadow-sm">{ret.status}</span>
                                <button onClick={() => generateCreditNotePDF(selectedOrder, ret)} className="text-xs flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 shadow-sm font-medium transition-colors">
                                  <FileMinus size={14} /> Download CN: {ret.credit_note_number}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Operations Workflow */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Operations Workflow</h3>
                    </div>
                    <div className="p-8 border-l-2 border-slate-200 ml-4 space-y-10 pb-4">
                        
                      {/* Payment Verification */}
                      <div className="relative pl-8">
                        <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-[0_0_0_4px_white]"><CreditCard size={14} /></div>
                        <div>
                          <h4 className="font-bold text-slate-900">PAYMENT VERIFICATION</h4>
                          {(selectedOrder.payment_status === 'Unpaid' || selectedOrder.payment_status === 'Pending Verification' || selectedOrder.payment_status === 'Failed') && (
                            <div className="mt-4 flex items-center gap-2">
                              <button onClick={() => advanceStatus('approve_payment')} disabled={updateStatusMutation.isPending} className="text-xs bg-amber-500 text-white px-5 py-2 rounded shadow-sm hover:bg-amber-600 transition-all disabled:opacity-50">Approve</button>
                              <button onClick={() => advanceStatus('reject_payment')} disabled={updateStatusMutation.isPending} className="text-xs border border-rose-200 bg-rose-50 text-rose-600 px-5 py-2 rounded shadow-sm hover:bg-rose-100 transition-all disabled:opacity-50 flex items-center gap-1"><XCircle size={14} /> Reject</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Picking / Packing */}
                      <div className="relative pl-8">
                        <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-[0_0_0_4px_white]"><Package size={14} /></div>
                        <div>
                          <h4 className="font-bold text-slate-900">FULFILMENT</h4>
                          {selectedOrder.fulfilment_status === 'Unconfirmed' && selectedOrder.payment_status === 'Paid' && (
                            <button onClick={() => advanceStatus('mark_picking')} disabled={updateStatusMutation.isPending} className="mt-4 text-xs bg-indigo-500 text-white px-5 py-2 rounded shadow-sm hover:bg-indigo-600 transition-all disabled:opacity-50">Start Picking</button>
                          )}
                          {selectedOrder.fulfilment_status === 'Picking' && (
                            <div className="mt-4">
                              <input type="file" onChange={(e) => handleProofUpload(e, 'internal')} className="text-xs mb-2 block" />
                              <button onClick={() => advanceStatus('mark_packed')} disabled={updateStatusMutation.isPending || !selectedOrder.internal_proof_url} className="text-xs bg-slate-800 text-white px-5 py-2 rounded shadow-sm hover:bg-slate-700 transition-all disabled:opacity-50">Mark as Packed</button>
                            </div>
                          )}
                          {selectedOrder.fulfilment_status === 'Packed' && (
                            <button onClick={() => advanceStatus('open_ship_modal')} disabled={updateStatusMutation.isPending} className="mt-4 text-xs bg-slate-800 text-white px-5 py-2 rounded shadow-sm hover:bg-slate-700 transition-all disabled:opacity-50">Assign Courier & Ship</button>
                          )}
                          {(selectedOrder.fulfilment_status === 'Shipped / Out for Delivery' || selectedOrder.fulfilment_status === 'Failed Delivery') && (
                            <div className="mt-4 space-y-4">
                              <div>
                                <div className="flex gap-2 mb-2">
                                  <button onClick={() => advanceStatus('mark_delivered')} disabled={updateStatusMutation.isPending || !selectedOrder.delivery_proof_url} className="text-xs bg-emerald-600 text-white px-5 py-2 rounded shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50">Mark as Delivered</button>
                                  {selectedOrder.fulfilment_status !== 'Failed Delivery' && (
                                    <button onClick={() => advanceStatus('open_fail_modal')} disabled={updateStatusMutation.isPending} className="text-xs bg-rose-100 text-rose-700 border border-rose-200 px-5 py-2 rounded shadow-sm hover:bg-rose-200 transition-all disabled:opacity-50">Report Failure</button>
                                  )}
                                  {selectedOrder.fulfilment_status === 'Failed Delivery' && (
                                    <button onClick={() => advanceStatus('retry_shipment')} disabled={updateStatusMutation.isPending} className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-5 py-2 rounded shadow-sm hover:bg-blue-200 transition-all disabled:opacity-50">Retry Shipment</button>
                                  )}
                                </div>
                                <input type="file" onChange={(e) => handleProofUpload(e, 'delivery')} className="text-xs block" title="Upload Proof of Delivery" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- SHIPPING MODAL --- */}
        {isShipModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Truck size={16}/> Assign Shipment</h3>
                <button onClick={() => setIsShipModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={16}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Courier / Provider Name</label>
                  <input type="text" value={shipForm.courier_name} onChange={(e) => setShipForm({...shipForm, courier_name: e.target.value})} placeholder="e.g. J&T, DHL, Vireak Buntham" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Tracking Number</label>
                  <input type="text" value={shipForm.tracking_number} onChange={(e) => setShipForm({...shipForm, tracking_number: e.target.value})} placeholder="Enter tracking code" className="w-full border border-slate-300 rounded p-3 text-sm font-mono outline-none focus:border-slate-500" />
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsShipModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100">Cancel</button>
                <button onClick={submitShipping} disabled={updateStatusMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 flex items-center gap-2">
                  {updateStatusMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Package size={16} />} Mark as Shipped
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- FAILED DELIVERY MODAL --- */}
        {isFailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-rose-200 bg-rose-50 flex justify-between items-center">
                <h3 className="font-bold text-rose-800 flex items-center gap-2"><AlertTriangle size={16}/> Report Failed Delivery</h3>
                <button onClick={() => setIsFailModalOpen(false)} className="text-rose-400 hover:text-rose-700"><X size={16}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Reason for Failure</label>
                  <select value={failForm.reason} onChange={(e) => setFailForm({...failForm, reason: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500">
                    <option value="">-- Select Reason --</option>
                    <option value="Customer unavailable">Customer unavailable</option>
                    <option value="Wrong or incomplete address">Wrong or incomplete address</option>
                    <option value="Courier failed delivery">Courier failed delivery</option>
                    <option value="Customer rejected delivery">Customer rejected delivery</option>
                    <option value="Other">Other (See notes)</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-500">This will halt the fulfillment timeline and record the failure for audit.</p>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsFailModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100">Cancel</button>
                <button onClick={submitFailedDelivery} disabled={updateStatusMutation.isPending} className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded hover:bg-rose-700 flex items-center gap-2">
                  {updateStatusMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <AlertTriangle size={16} />} Confirm Failure
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- RETURN ITEM MODAL --- */}
        {isReturnModalOpen && selectedReturnItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 uppercase">Process Return & Restock</h2>
                <button onClick={() => setIsReturnModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-slate-100 p-3 rounded border border-slate-200 mb-4">
                  <p className="font-bold text-slate-800">{selectedReturnItem.item.product_name}</p>
                  <p className="text-xs text-slate-500 uppercase mt-0.5">Available to Return: {selectedReturnItem.maxQty}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Quantity to Return</label>
                  <input type="number" min="1" max={selectedReturnItem.maxQty} value={returnForm.quantity} onChange={(e) => setReturnForm({...returnForm, quantity: parseInt(e.target.value) || 1})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Condition</label>
                    <select value={returnForm.condition} onChange={(e) => setReturnForm({...returnForm, condition: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500">
                      <option value="Sellable">Sellable (Good)</option>
                      <option value="Damaged">Damaged (Non-Sellable)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Restock Location</label>
                    <input type="text" value={returnForm.warehouse} onChange={(e) => setReturnForm({...returnForm, warehouse: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Batch / Lot (Optional)</label>
                  <input type="text" value={returnForm.batch_lot} onChange={(e) => setReturnForm({...returnForm, batch_lot: e.target.value})} placeholder="Original batch provenance" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Reason</label>
                  <input type="text" value={returnForm.reason} onChange={(e) => setReturnForm({...returnForm, reason: e.target.value})} placeholder="e.g. Customer changed mind" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
                </div>
                
                <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                  * A formal Credit Note PDF will be generated to legally offset the original Invoice value for accounting purposes.
                </p>
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsReturnModalOpen(false)} disabled={processReturnMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded">Cancel</button>
                <button onClick={() => processReturnMutation.mutate()} disabled={processReturnMutation.isPending} className="px-6 py-2.5 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2">
                  {processReturnMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <RotateCcw size={16} />} Approve Return
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}