// @ts-nocheck
import React, { useState } from 'react';
import { Download, Calendar, RefreshCcw, FileSpreadsheet, Package, Users, ShoppingCart, DollarSign, ArrowRightLeft, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';

const EXPORT_TYPES = [
  { id: 'orders', title: 'Orders Export', icon: ShoppingCart, desc: 'Full order history including fulfilment status, couriers, and tracking info.', rpc: 'export_orders', needsDate: true },
  { id: 'payments', title: 'Payments Export', icon: DollarSign, desc: 'Verified payments, transaction references, and paid timestamps.', rpc: 'export_payments', needsDate: true },
  { id: 'stock', title: 'Current Stock Balances', icon: Package, desc: 'Real-time global snapshot of On-Hand, Reserved, and Available variants.', rpc: 'export_stock', needsDate: false },
  { id: 'ledger', title: 'Inventory Ledger', icon: FileSpreadsheet, desc: 'Immutable movement history including receipts, transfers, and adjustments.', rpc: 'export_inventory_ledger', needsDate: true },
  { id: 'returns', title: 'Returns & Credit Notes', icon: ArrowRightLeft, desc: 'Processed returns, conditions, restock locations, and financial credit notes.', rpc: 'export_returns', needsDate: true },
  { id: 'customers', title: 'Customer Demographics', icon: Users, desc: 'Customer registration dates, total lifetime value, and order frequencies.', rpc: 'export_customers', needsDate: true },
  { id: 'products', title: 'Products & SKUs', icon: Package, desc: 'Global catalogue extract including base prices, costs, and active status.', rpc: 'export_products', needsDate: false },
  { id: 'net_sales', title: 'Net Sales Report', icon: DollarSign, desc: 'Aggregated accounting calculation of Gross Sales minus Refunds over time.', rpc: 'export_net_sales', needsDate: true },
  { id: 'channels', title: 'Sales Channel Performance', icon: Target, desc: 'Revenue attribution across tracked sales channels (Website, FB, etc.).', rpc: 'export_channels', needsDate: true }
];

export default function Reports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeExport, setActiveExport] = useState(/** @type {string | null} */ (null));

  const downloadCSV = (/** @type {any[]} */ jsonData, /** @type {string} */ filename) => {
    if (!jsonData || !jsonData.length) {
      alert("No data found for the selected parameters.");
      return;
    }
    const headers = Object.keys(jsonData[0]);
    const csvRows = jsonData.map(row => 
      headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(',')
    );
    csvRows.unshift(headers.join(','));
    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMutation = useMutation({
    mutationFn: async (/** @type {any} */ exportConfig) => {
      setActiveExport(exportConfig.id);
      
      const rpcArgs = {};
      if (exportConfig.needsDate) {
        rpcArgs.p_start_date = startDate || null;
        rpcArgs.p_end_date = endDate || null;
      }

      const { data, error } = await supabase.rpc(exportConfig.rpc, rpcArgs);
      
      if (error) {
        if (error.message.includes('RBAC')) throw new Error("Permission Denied: You do not have 'exports:execute' clearance.");
        throw error;
      }
      return { data, id: exportConfig.id };
    },
    onSuccess: (result) => {
      const dateStr = new Date().toISOString().split('T')[0];
      downloadCSV(result.data, `NOIR_${result.id.toUpperCase()}_EXPORT_${dateStr}.csv`);
      setActiveExport(null);
    },
    onError: (err) => {
      alert("Export Failed: " + err.message);
      setActiveExport(null);
    }
  });

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col min-h-[calc(100vh-8rem)]">
      
      <div className="p-6 border-b border-slate-200 bg-slate-50 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">Reports & Exports</h1>
        <p className="text-sm text-slate-500 mt-1">Generate unpaginated, server-side CSV extracts and accounting reports.</p>
        
        {/* Global Date Filter */}
        <div className="mt-6 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm w-fit">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
            <Calendar size={16} className="text-slate-400"/> Filter Range:
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-slate-300 rounded overflow-hidden">
              <span className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 border-r border-slate-300">FROM</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1.5 text-sm outline-none focus:bg-slate-50 text-slate-700" />
            </div>
            <div className="flex items-center border border-slate-300 rounded overflow-hidden">
              <span className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 border-r border-slate-300">TO</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1.5 text-sm outline-none focus:bg-slate-50 text-slate-700" />
            </div>
          </div>
          {(startDate || endDate) && (
             <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-xs text-rose-500 hover:text-rose-700 font-semibold px-2">Clear</button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/50 flex-1">
        {EXPORT_TYPES.map((config) => (
          <div key={config.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all">
            <div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 mb-4 border border-slate-200">
                <config.icon size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{config.title}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed h-10">{config.desc}</p>
            </div>
            
            <button 
              onClick={() => exportMutation.mutate(config)}
              disabled={exportMutation.isPending && activeExport === config.id}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {exportMutation.isPending && activeExport === config.id ? <RefreshCcw size={14} className="animate-spin" /> : <Download size={14} />} 
              {exportMutation.isPending && activeExport === config.id ? 'Generating...' : config.needsDate && (startDate || endDate) ? 'Export Filtered' : 'Export Full'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}