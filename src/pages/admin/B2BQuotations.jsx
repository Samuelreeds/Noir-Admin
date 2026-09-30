// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Search, Plus, ArrowLeft, Save, FileText, CheckCircle, Ban, Download, ShoppingCart, Trash2 } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const generateQuotePDF = (/** @type {any} */ quote) => {
  const doc = new jsPDF();
  
  doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.text("NOIR MTD CO., LTD.", 14, 22);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("WHOLESALE QUOTATION", 195, 22, { align: "right" });
  
  doc.setTextColor(0);
  doc.text(`Quote Ref: QT-${quote.id.slice(-8).toUpperCase()}`, 14, 34);
  doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, 14, 40);
  doc.text(`Valid Until: ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'N/A'}`, 14, 46);
  
  doc.setFont("helvetica", "bold"); doc.text("Prepared For:", 120, 34);
  doc.setFont("helvetica", "normal");
  doc.text(quote.b2b_companies?.company_name || "N/A", 120, 40);
  doc.text(quote.b2b_companies?.contact_email || "N/A", 120, 46);
  doc.text(quote.b2b_companies?.contact_phone || "N/A", 120, 52);
  
  const tableData = (quote.b2b_quotation_items || []).map((/** @type {any} */ item) => [
    item.product_variants?.products?.name || 'Item',
    item.product_variants?.sku || 'N/A',
    item.quantity.toString(),
    `$${item.unit_price.toFixed(2)}`,
    `$${item.total_price.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 65, head: [['Product', 'SKU', 'Qty', 'Unit Price', 'Total']], body: tableData, theme: 'plain',
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 }, alternateRowStyles: { fillColor: [248, 248, 248] }
  });

  const finalY = /** @type {any} */ (doc).lastAutoTable.finalY + 12;
  
  doc.text(`Subtotal:`, 140, finalY); doc.text(`$${quote.subtotal.toFixed(2)}`, 195, finalY, { align: "right" });
  
  if (quote.tax > 0) {
    doc.text(`Tax:`, 140, finalY + 8); doc.text(`$${quote.tax.toFixed(2)}`, 195, finalY + 8, { align: "right" });
  }
  
  const totalY = finalY + (quote.tax > 0 ? 18 : 10);
  doc.setFont("helvetica", "bold");
  doc.text(`Grand Total:`, 140, totalY); doc.text(`$${quote.grand_total.toFixed(2)}`, 195, totalY, { align: "right" });
  
  doc.save(`Quotation_QT-${quote.id.slice(-8).toUpperCase()}.pdf`);
};

export default function B2BQuotations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState('list'); // 'list' or 'create'
  const [search, setSearch] = useState('');

  // Draft State
  const [draftCompany, setDraftCompany] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftItems, setDraftItems] = useState(/** @type {any[]} */ ([]));
  const [selectedVariant, setSelectedVariant] = useState('');

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['b2b-quotations-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('b2b_quotations')
        .select('*, b2b_companies(company_name, contact_email, contact_phone), b2b_quotation_items(*, product_variants(sku, products(name)))')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['b2b-companies-active'],
    queryFn: async () => {
      const { data } = await supabase.from('b2b_companies').select('id, company_name').eq('status', 'approved');
      return data || [];
    }
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['all-variants-for-quote'],
    queryFn: async () => {
      const { data } = await supabase.from('product_variants').select('id, sku, price, products(name)').eq('is_active', true);
      return data || [];
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('b2b_quotations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['b2b-quotations-admin'] })
  });

  const convertToOrderMutation = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.rpc('convert_quotation_to_order', { p_quotation_id: id, p_admin_id: user.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (orderId) => {
      alert(`Quote successfully converted to Order MA-${orderId.slice(-8).toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ['b2b-quotations-admin'] });
    },
    onError: (err) => alert(err.message)
  });

  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!draftCompany || draftItems.length === 0) throw new Error('Company and at least 1 item required.');
      
      const subtotal = draftItems.reduce((sum, item) => sum + item.total_price, 0);
      
      const { data: qData, error: qError } = await supabase.from('b2b_quotations').insert([{
        company_id: draftCompany, created_by: user.id, status: 'draft', subtotal, grand_total: subtotal, notes: draftNotes
      }]).select('id').single();
      
      if (qError) throw qError;

      const itemsToInsert = draftItems.map(item => ({
        quotation_id: qData.id, variant_id: item.variant.id, quantity: item.quantity, unit_price: item.unit_price, total_price: item.total_price
      }));

      const { error: iError } = await supabase.from('b2b_quotation_items').insert(itemsToInsert);
      if (iError) throw iError;
    },
    onSuccess: () => {
      setView('list'); setDraftCompany(''); setDraftItems([]); setDraftNotes('');
      queryClient.invalidateQueries({ queryKey: ['b2b-quotations-admin'] });
    },
    onError: (err) => alert(err.message)
  });

  const addDraftItem = () => {
    if (!selectedVariant) return;
    const v = variants.find(x => x.id === selectedVariant);
    if (!v) return;
    
    setDraftItems(prev => [...prev, { variant: v, quantity: 1, unit_price: v.price, total_price: v.price }]);
    setSelectedVariant('');
  };

  const updateDraftItem = (index, field, value) => {
    setDraftItems(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      if (field === 'quantity' || field === 'unit_price') {
        copy[index].total_price = copy[index].quantity * copy[index].unit_price;
      }
      return copy;
    });
  };

  const removeDraftItem = (index) => setDraftItems(prev => prev.filter((_, i) => i !== index));

  if (view === 'create') {
    const draftTotal = draftItems.reduce((sum, item) => sum + item.total_price, 0);
    return (
      <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={18}/></button>
            <h1 className="text-xl font-bold text-slate-900">Draft New Quotation</h1>
          </div>
          <button 
            onClick={() => createQuoteMutation.mutate()} 
            disabled={!draftCompany || draftItems.length === 0 || createQuoteMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={16}/> {createQuoteMutation.isPending ? 'Saving...' : 'Save Draft Quote'}
          </button>
        </div>

        <div className="p-6 md:p-8 flex-1 w-full max-w-5xl mx-auto space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Select B2B Client</label>
              <select value={draftCompany} onChange={e => setDraftCompany(e.target.value)} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500">
                <option value="">-- Choose Company --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Quote Notes / Terms</label>
              <input type="text" value={draftNotes} onChange={e => setDraftNotes(e.target.value)} placeholder="e.g. Valid for 14 days" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-100 flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Add Product to Quote</label>
                <select value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)} className="w-full border border-slate-300 rounded p-2.5 text-sm bg-white outline-none">
                  <option value="">-- Search SKU or Name --</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.products?.name} (SKU: {v.sku}) - Retail: ${v.price}</option>)}
                </select>
              </div>
              <button onClick={addDraftItem} disabled={!selectedVariant} className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-50 disabled:opacity-50">
                <Plus size={16}/>
              </button>
            </div>
            
            <table className="w-full text-left text-sm bg-white">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-3">Product / SKU</th>
                  <th className="px-4 py-3 w-32 text-center">Qty</th>
                  <th className="px-4 py-3 w-40 text-right">Unit Price ($)</th>
                  <th className="px-4 py-3 w-40 text-right">Total ($)</th>
                  <th className="px-4 py-3 w-16 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draftItems.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No items added to quote.</td></tr> : draftItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-medium">{item.variant.products?.name} <span className="text-xs text-slate-500 block">{item.variant.sku}</span></td>
                    <td className="px-4 py-3">
                      <input type="number" min="1" value={item.quantity} onChange={e => updateDraftItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full border rounded p-2 text-center outline-none" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" step="0.01" value={item.unit_price} onChange={e => updateDraftItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full border rounded p-2 text-right outline-none" />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">${item.total_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => removeDraftItem(idx)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <p className="text-lg font-bold text-slate-900">Draft Total: ${draftTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filtered = quotes.filter((q) => q.b2b_companies?.company_name?.toLowerCase().includes(search.toLowerCase()) || q.id.includes(search));

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Quotes..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
        </div>
        <button onClick={() => setView('create')} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors">
          <Plus size={16}/> Create Quotation
        </button>
      </div>
      
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0">
            <tr>
              <th className="px-4 py-3">Quote Ref</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading...</td></tr> : filtered.map(q => {
               const isDraft = q.status === 'draft';
               const isApproved = q.status === 'approved';
               const isConverted = q.status === 'converted';

               return (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-900">QT-{q.id.slice(-8).toUpperCase()}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-800">{q.b2b_companies?.company_name}</p>
                    <p className="text-xs text-slate-500">{new Date(q.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-900">${q.grand_total?.toFixed(2)}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      isConverted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      isDraft ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => generateQuotePDF(q)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors" title="Download PDF">
                        <Download size={16}/>
                      </button>
                      
                      {isDraft && (
                        <button onClick={() => updateStatusMutation.mutate({ id: q.id, status: 'approved' })} className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold hover:bg-emerald-100">
                          Approve Quote
                        </button>
                      )}
                      
                      {isApproved && (
                        <button onClick={() => convertToOrderMutation.mutate(q.id)} disabled={convertToOrderMutation.isPending} className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50">
                          <ShoppingCart size={12}/> Convert to Order
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}