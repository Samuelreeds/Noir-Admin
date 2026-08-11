import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form state for creating a new product
  const [form, setForm] = useState({
    name: '',
    code: '',
    price: '',
    discount: '0',
    stock: '10',
    image: '',
    category: 'General'
  });

  const queryClient = useQueryClient();

  // 1. Fetch Products from Supabase with Caching
  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutation to Insert a New Product
  const addProductMutation = useMutation({
    mutationFn: async (/** @type {any} */ newProd) => {
      const { data, error } = await supabase
        .from('products')
        .insert([newProd])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-list'] });
      setIsAddModalOpen(false);
      setForm({ name: '', code: '', price: '', discount: '0', stock: '10', image: '', category: 'General' });
    },
    onError: (err) => {
      console.error("Error creating product:", err);
      alert("Failed to create product. Please check your Supabase table schema.");
    }
  });

  // Reset pagination on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Filter Logic
  const filteredProducts = products.filter((/** @type {any} */ p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${p.name || ''} ${p.code || ''} ${p.category || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Export to Excel (CSV)
  const exportToCSV = () => {
    if (filteredProducts.length === 0) return alert("No data to export!");
    const headers = ['Product Code', 'Product Name', 'Price', 'Discount', 'Stock', 'Status'];
    const rows = filteredProducts.map((/** @type {any} */ p) => [
      p.code || 'N/A',
      p.name || 'N/A',
      p.price || 0,
      p.discount || 0,
      p.stock > 0 ? 'In-Stock' : 'Out of Stock',
      p.status || 'ACTIVE'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitNew = (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return alert("Please fill in the product name and price.");
    addProductMutation.mutate({
      name: form.name,
      code: form.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      price: parseFloat(form.price),
      discount: parseFloat(form.discount || 0),
      stock: parseInt(form.stock || 10),
      image: form.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
      status: 'active'
    });
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
            placeholder="Search products by name or code..." 
            className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" 
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
            <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors">
            <Download size={14} /> Export Excel
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors">
            <Plus size={14} /> Create New
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Product Code</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Price($)</th>
              <th className="px-4 py-3 text-right">Discount($)</th>
              <th className="px-4 py-3 text-center">Product Stock</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading products...</td></tr>
            ) : paginatedProducts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No products found. Click 'Create New' to add one.</td></tr>
            ) : (
              paginatedProducts.map((/** @type {any} */ p) => {
                const isActive = p.status !== 'inactive';
                const isOutOfStock = p.stock <= 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{p.code || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400"><Package size={18} /></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">${p.price?.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-slate-600">${p.discount?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium border ${
                        isOutOfStock 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : 'In-Stock'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wider border ${
                        isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isActive ? 'ACTIVE' : 'IN-ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete">
                          <Trash2 size={14} />
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

      {/* --- CREATE NEW PRODUCT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Create New Product</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitNew} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Name</label>
                  <input 
                    type="text" 
                    value={form.name} 
                    onChange={(e) => setForm({...form, name: e.target.value})} 
                    placeholder="e.g. Obsidian Trench Coat" 
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Code / SKU</label>
                  <input 
                    type="text" 
                    value={form.code} 
                    onChange={(e) => setForm({...form, code: e.target.value})} 
                    placeholder="e.g. BRC-01" 
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.price} 
                    onChange={(e) => setForm({...form, price: e.target.value})} 
                    placeholder="450.00" 
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Discount ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.discount} 
                    onChange={(e) => setForm({...form, discount: e.target.value})} 
                    placeholder="0.00" 
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Stock Qty</label>
                  <input 
                    type="number" 
                    value={form.stock} 
                    onChange={(e) => setForm({...form, stock: e.target.value})} 
                    placeholder="10" 
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Image URL</label>
                <input 
                  type="url" 
                  value={form.image} 
                  onChange={(e) => setForm({...form, image: e.target.value})} 
                  placeholder="https://images.unsplash.com/..." 
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={addProductMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {addProductMutation.isPending ? 'Creating...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}