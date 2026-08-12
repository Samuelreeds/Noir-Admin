import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, Search, X, Package, AlertTriangle, 
  List, BarChart2, History, ArrowUpDown, FileSpreadsheet, FileText, Calendar 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;
const LOW_STOCK_THRESHOLD = 10;

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'analytics', 'log'
  
  // List State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  
  // Log State
  const [logSearch, setLogSearch] = useState('');
  const [logReason, setLogReason] = useState('All Reasons');
  const [logCategory, setLogCategory] = useState('All Categories');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edit Modal State
  const [selectedProduct, setSelectedProduct] = useState(/** @type {any} */ (null));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newStock, setNewStock] = useState('');

  const queryClient = useQueryClient();

  // 1. Fetch Products
  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-inventory-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('stock', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Logs
  const { data: logs = [], isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['admin-inventory-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_logs')
        .select('*, products(name, code, image, category)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 3. Mutation: Update Stock & Insert Log
  const updateStockMutation = useMutation({
    mutationFn: async (/** @type {{ id: string, oldStock: number, newStock: number, productName: string }} */ payload) => {
      const change = payload.newStock - payload.oldStock;
      
      // Update Product Table
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: payload.newStock })
        .eq('id', payload.id);
      if (updateError) throw updateError;

      // Insert Log
      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          product_id: payload.id,
          change_amount: change,
          previous_stock: payload.oldStock,
          new_stock: payload.newStock,
          reason: 'ADJUSTMENTS',
          details: `Manual adjustment via admin panel`,
          user_name: 'Admin'
        }]);
      if (logError) throw logError;
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-logs'] });
      setIsEditModalOpen(false);
      setSelectedProduct(null);
    },
    onError: (err) => alert("Failed to update stock: " + err.message)
  });

  // Derived Data & Summaries
  const categories = ['All Categories', ...new Set(products.map((/** @type {any} */ p) => p.category).filter(Boolean))];
  
  const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const outOfStockCount = products.filter(p => (p.stock || 0) <= 0).length;
  const lowStockCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= LOW_STOCK_THRESHOLD).length;
  const totalValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

  // Filters
  const filteredProducts = products.filter((/** @type {any} */ p) => {
    if (categoryFilter !== 'All Categories' && p.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return `${p.name} ${p.code}`.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredLogs = logs.filter((/** @type {any} */ log) => {
    if (logCategory !== 'All Categories' && log.products?.category !== logCategory) return false;
    if (logReason !== 'All Reasons' && log.reason !== logReason.toUpperCase()) return false;
    
    if (logSearch) {
      const q = logSearch.toLowerCase();
      const string = `${log.products?.name} ${log.products?.code} ${log.details}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;

    return true;
  });

  // Handlers
  const handleOpenEdit = (/** @type {any} */ product) => {
    setSelectedProduct(product);
    setNewStock(product.stock?.toString() || '0');
    setIsEditModalOpen(true);
  };

  const handleSaveStock = (/** @type {any} */ e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = parseInt(newStock);
    if (isNaN(qty) || qty < 0) return alert("Please enter a valid stock quantity.");
    updateStockMutation.mutate({ 
      id: selectedProduct.id, 
      oldStock: selectedProduct.stock || 0, 
      newStock: qty,
      productName: selectedProduct.name 
    });
  };

  const handleRefresh = () => {
    refetchProducts();
    refetchLogs();
  };

  // UI Components
  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <p className="text-sm text-slate-500 font-medium mb-2">Total Stock</p>
        <div className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Package size={20} className="text-slate-700" /> {totalStock.toLocaleString()}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <p className="text-sm text-slate-500 font-medium mb-2">Low Stock Items</p>
        <div className="flex items-center gap-2 text-2xl font-bold text-amber-600">
          <AlertTriangle size={20} /> {lowStockCount.toLocaleString()}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <p className="text-sm text-slate-500 font-medium mb-2">Out of Stock</p>
        <div className="flex items-center gap-2 text-2xl font-bold text-rose-600">
          <Package size={20} /> {outOfStockCount.toLocaleString()}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <p className="text-sm text-slate-500 font-medium mb-2">Total Value</p>
        <div className="text-2xl font-bold text-slate-900">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto pb-10">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-1">Inventory</h1>
          <p className="text-sm text-slate-500">Track and manage product stock levels</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 border border-slate-200 rounded-lg shadow-sm">
          <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <List size={16} /> Stock List
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <BarChart2 size={16} /> Analytics
          </button>
          <button onClick={() => setActiveTab('log')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'log' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <History size={16} /> Stock Log
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {renderSummaryCards()}

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-[calc(100vh-22rem)] min-h-[500px]">
            <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 bg-slate-50/50">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-slate-500 w-48">
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <div className="relative flex-1 max-w-xl">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, SKU, or variant..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
              </div>
            </div>

            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Color / Variant</th>
                    <th className="px-6 py-4 w-48">Stock Level</th>
                    <th className="px-6 py-4 text-center">Threshold</th>
                    <th className="px-6 py-4 text-right">Stock Value</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingProducts ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading inventory...</td></tr>
                  ) : filteredProducts.map((p) => {
                    const stock = p.stock || 0;
                    const stockPercent = Math.min(100, (stock / 200) * 100); // UI visual scale up to 200 units
                    const isOut = stock <= 0;
                    const stockValue = stock * (p.price || 0);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded border border-slate-200 overflow-hidden bg-white shrink-0">
                              {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Package size={20} className="text-slate-400 m-auto h-full" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-500 uppercase">{p.code || 'BASE PRODUCT'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: p.hex_code || '#e2e8f0' }} />
                            <span className="text-slate-600 text-xs uppercase">{p.color_name || 'BASE PRODUCT'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-xs mb-1.5">{stock} units</p>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isOut ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${stockPercent}%` }} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{LOW_STOCK_THRESHOLD}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">${stockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${isOut ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {isOut ? 'Out of Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleOpenEdit(p)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all">
                            <ArrowUpDown size={12} /> Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-[calc(100vh-14rem)] min-h-[500px]">
            
            <div className="p-4 border-b border-slate-200 space-y-4 bg-slate-50/50">
              <div className="flex flex-wrap gap-4">
                <select value={logCategory} onChange={(e) => setLogCategory(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-slate-500 w-40">
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={logReason} onChange={(e) => setLogReason(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-slate-500 w-40">
                  {['All Reasons', 'Adjustments', 'Purchases', 'Returns', 'Cancellations', 'Damage', 'Reservations'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="Search logs by product or notes..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 flex items-center gap-2"><Calendar size={14} /> Filter by Date:</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white outline-none" />
                  <span className="text-slate-400">-</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white outline-none" />
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded text-sm font-medium transition-colors">
                    <FileSpreadsheet size={14} /> Export Excel
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-sm font-medium transition-colors">
                    <FileText size={14} /> Export PDF report
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4 text-center">Change</th>
                    <th className="px-6 py-4 text-center">Reason</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingLogs ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading logs...</td></tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No logs found matching criteria.</td></tr>
                  ) : filteredLogs.map((log) => {
                    const isPositive = log.change_amount > 0;
                    const changeColor = isPositive ? 'text-emerald-600' : 'text-rose-600';
                    const changePrefix = isPositive ? '+' : '';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{log.products?.name || 'Unknown Product'}</p>
                          <p className="text-xs text-slate-500 uppercase">{log.products?.code || 'BASE PRODUCT'}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className={`font-bold ${changeColor} mb-0.5`}>{changePrefix}{log.change_amount}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{log.previous_stock} → {log.new_stock}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2.5 py-1 border border-slate-200 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold tracking-wider uppercase">
                            {log.reason}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-800 text-xs italic">"{log.details}"</p>
                          <p className="text-[10px] text-slate-400 mt-1">by {log.user_name}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-slate-500">
                          {new Date(log.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-12 text-center">
             <BarChart2 size={48} className="text-slate-300 mx-auto mb-4" />
             <h3 className="text-lg font-semibold text-slate-800 mb-2">Inventory Analytics</h3>
             <p className="text-slate-500 max-w-md mx-auto">Advanced charting and velocity metrics will be displayed here in a future update.</p>
          </div>
        </div>
      )}

      {/* --- ADJUST STOCK MODAL --- */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Adjust Stock Qty</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveStock} className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-900 mb-1">{selectedProduct.name}</p>
                <p className="text-xs font-mono text-slate-500 mb-4">SKU: {selectedProduct.code || 'N/A'}</p>
                
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">New Stock Quantity</label>
                  <span className="text-xs text-slate-400">Current: {selectedProduct.stock || 0}</span>
                </div>
                
                <input 
                  type="number" 
                  value={newStock} 
                  onChange={(e) => setNewStock(e.target.value)} 
                  required
                  min="0"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500 font-mono" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updateStockMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {updateStockMutation.isPending ? 'Updating...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}