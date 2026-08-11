import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Edit, X, ChevronLeft, ChevronRight, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(/** @type {any} */ (null));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newStock, setNewStock] = useState('');

  const queryClient = useQueryClient();

  // 1. Fetch Products & Stock from Supabase with Caching
  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('stock', { ascending: true }); // Low stock items rise to the top

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutation to Update Stock Quantity
  const updateStockMutation = useMutation({
    mutationFn: async (/** @type {{ id: string, stock: number }} */ { id, stock }) => {
      const { data, error } = await supabase
        .from('products')
        .update({ stock })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      setIsEditModalOpen(false);
      setSelectedProduct(null);
    },
    onError: (err) => {
      console.error("Error updating stock:", err);
      alert("Failed to update stock levels.");
    }
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Filter Logic
  const filteredProducts = products.filter((/** @type {any} */ p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${p.name || ''} ${p.code || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
    
    updateStockMutation.mutate({ id: selectedProduct.id, stock: qty });
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search inventory by product name or code..." 
            className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" 
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
            <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Product Code</th>
              <th className="px-4 py-3">Product Name</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-center">Stock Level</th>
              <th className="px-4 py-3 text-center">Inventory Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading inventory...</td></tr>
            ) : paginatedProducts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No inventory records found.</td></tr>
            ) : (
              paginatedProducts.map((/** @type {any} */ p) => {
                const stock = p.stock ?? 0;
                const isOut = stock <= 0;
                const isLow = stock > 0 && stock <= 5;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{p.code || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400"><Package size={16} /></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-800">${p.price?.toFixed(2)}</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900">{stock} units</td>
                    <td className="px-4 py-4 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-medium">
                          <AlertTriangle size={12} /> Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                          <AlertTriangle size={12} /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                          <CheckCircle size={12} /> In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button onClick={() => handleOpenEdit(p)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors">
                          <Edit size={12} /> Adjust Stock
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
          Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} entries
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
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">New Stock Quantity</label>
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
                  {updateStockMutation.isPending ? 'Updating...' : 'Save Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}