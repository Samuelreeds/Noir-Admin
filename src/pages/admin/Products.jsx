import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Package, Filter, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

// --- IMAGE PROCESSING & UPLOAD HELPERS ---
const processImageToWebP = (/** @type {File} */ file) => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error("File too large. Please select an image under 10MB."));
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = /** @type {string} */ (event.target?.result);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let { width, height } = img;
        if (width > height && width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
        else if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Failed to get canvas context"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas conversion failed'));
          if (blob.size > 5 * 1024 * 1024) return reject(new Error('Processed image is still over 5MB.'));
          const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
          resolve(webpFile);
        }, 'image/webp', 0.8);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const uploadImageToSupabase = async (/** @type {File} */ file) => {
  const processedFile = await processImageToWebP(file);
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.webp`;
  const filePath = `products/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, processedFile);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
  return data.publicUrl;
};

// --- MAIN COMPONENT ---
export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState(/** @type {string[]} */ ([]));
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(/** @type {{id: string, name: string} | null} */ (null));
  
  // Added gender to form states
  const defaultForm = { name: '', code: '', price: '', discount: '0', stock: '10', category: 'General', gender: '', image: '', imageFile: null, imagePreview: '' };
  const [form, setForm] = useState(defaultForm);
  const [editForm, setEditForm] = useState({ id: '', ...defaultForm });

  const queryClient = useQueryClient();

  // Fetch Store Settings for dynamic Genders list
  // Fetch Store Settings for dynamic Genders list
  const { data: settings } = useQuery({
    queryKey: ['admin-web-setup-genders'],
    queryFn: async () => {
      const { data } = await supabase.from('store_settings').select('genders').eq('id', 1).single();
      return /** @type {any} */ (data || {});
    }
  });
  
  const allowedGenders = /** @type {any} */ (settings)?.genders || ["Men", "Women", "Unisex"];
  
  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addProductMutation = useMutation({
    mutationFn: async (/** @type {any} */ newProd) => {
      let finalImageUrl = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80'; 
      if (newProd.imageFile) finalImageUrl = await uploadImageToSupabase(newProd.imageFile);
      const { imageFile, imagePreview, ...rest } = newProd;
      const { data, error } = await supabase.from('products').insert([{ ...rest, image: finalImageUrl }]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-list'] });
      closeAddModal();
    },
    onError: (err) => alert(err.message)
  });

  const updateProductMutation = useMutation({
    mutationFn: async (/** @type {any} */ updatedProd) => {
      let finalImageUrl = updatedProd.image;
      if (updatedProd.imageFile) finalImageUrl = await uploadImageToSupabase(updatedProd.imageFile);
      const { id, imageFile, imagePreview, ...rest } = updatedProd;
      const { data, error } = await supabase.from('products').update({ ...rest, image: finalImageUrl }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-list'] });
      closeEditModal();
    },
    onError: (err) => alert(err.message)
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-list'] });
      setSelectedProductIds([]); 
      setProductToDelete(null); 
    }
  });

  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryFilter]);

  const categories = ['All Categories', ...new Set(products.map((/** @type {any} */ p) => p.category).filter(Boolean))];

  const filteredProducts = products.filter((/** @type {any} */ p) => {
    if (categoryFilter !== 'All Categories' && p.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const string = `${p.name || ''} ${p.code || ''}`.toLowerCase();
      if (!string.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSelectAll = () => {
    if (selectedProductIds.length === paginatedProducts.length && paginatedProducts.length > 0) setSelectedProductIds([]);
    else setSelectedProductIds(paginatedProducts.map((/** @type {any} */ p) => p.id));
  };
  const toggleSelect = (/** @type {string} */ id) => setSelectedProductIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleDelete = (/** @type {string} */ id, /** @type {string} */ name) => setProductToDelete({ id, name });
  const confirmDelete = () => { if (productToDelete) deleteProductMutation.mutate(productToDelete.id); };

  const handleEditOpen = (/** @type {any} */ p) => {
    setEditForm({
      id: p.id, name: p.name || '', code: p.code || '', price: p.price || '', discount: p.discount || '0', 
      stock: p.stock || '0', category: p.category || 'General', gender: p.gender || '', image: p.image || '', imageFile: null, imagePreview: p.image || ''
    });
    setIsEditModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    if (form.imagePreview && form.imageFile) URL.revokeObjectURL(form.imagePreview);
    setForm(defaultForm);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    if (editForm.imagePreview && editForm.imageFile) URL.revokeObjectURL(editForm.imagePreview);
    setEditForm({ id: '', ...defaultForm });
  };

  const handleFileChange = (/** @type {any} */ e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (isEdit) setEditForm(prev => ({ ...prev, imageFile: file, imagePreview: previewUrl }));
    else setForm(prev => ({ ...prev, imageFile: file, imagePreview: previewUrl }));
  };

  const exportToCSV = () => {
    const listToExport = selectedProductIds.length > 0 ? products.filter((/** @type {any} */ p) => selectedProductIds.includes(p.id)) : filteredProducts;
    if (listToExport.length === 0) return alert("No data to export!");
    const headers = ['Product Code', 'Product Name', 'Category', 'Gender', 'Price', 'Discount', 'Stock', 'Status'];
    const rows = listToExport.map((/** @type {any} */ p) => [
      p.code || 'N/A', p.name || 'N/A', p.category || 'N/A', p.gender || 'N/A', p.price || 0, p.discount || 0, p.stock, p.status || 'ACTIVE'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitNew = (/** @type {any} */ e) => {
    e.preventDefault();
    if (!form.name || !form.price) return alert("Please fill in the product name and price.");
    addProductMutation.mutate({
      ...form,
      code: form.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      category: form.category || 'General',
      gender: form.gender || null,
      price: parseFloat(form.price),
      discount: parseFloat(form.discount || '0'), 
      stock: parseInt(form.stock || '10', 10),
      status: 'active'
    });
  };

  const handleSubmitEdit = (/** @type {any} */ e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.price) return alert("Please fill in the product name and price.");
    updateProductMutation.mutate({
      ...editForm,
      gender: editForm.gender || null,
      price: parseFloat(editForm.price),
      discount: parseFloat(editForm.discount || '0'), 
      stock: parseInt(editForm.stock || '0', 10),
    });
  };

  return (
    <div className="w-full bg-white rounded-md shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
        <div className="flex gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products by name or code..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500" />
          </div>
          <div className="relative shrink-0 w-48">
             <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
             <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full bg-white outline-none focus:border-slate-500 appearance-none cursor-pointer">
               {categories.map((/** @type {any} */ cat) => <option key={cat} value={cat}>{cat}</option>)}
             </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors"><RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh</button>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors"><Download size={14} /> {selectedProductIds.length > 0 ? `Export (${selectedProductIds.length})` : 'Export Excel'}</button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors"><Plus size={14} /> Create New</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-10"><input type="checkbox" checked={paginatedProducts.length > 0 && selectedProductIds.length === paginatedProducts.length} onChange={toggleSelectAll} className="rounded border-slate-300 cursor-pointer"/></th>
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
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading products...</td></tr>
            ) : paginatedProducts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No products found.</td></tr>
            ) : (
              paginatedProducts.map((/** @type {any} */ p) => {
                const isActive = p.status !== 'inactive';
                const isOutOfStock = p.stock <= 0;
                const isSelected = selectedProductIds.includes(p.id);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/50 ${isSelected ? 'bg-slate-50' : ''}`}>
                    <td className="px-4 py-4"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="rounded border-slate-300 cursor-pointer"/></td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{p.code || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Package size={18} /></div>}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{p.category} {p.gender && `· ${p.gender}`}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">${p.price?.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-slate-600">${p.discount?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium border ${isOutOfStock ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {isOutOfStock ? 'Out of Stock' : `${p.stock} In-Stock`}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wider border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {isActive ? 'ACTIVE' : 'IN-ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button onClick={() => handleEditOpen(p)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Edit"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete"><Trash2 size={14} /></button>
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
        <div className="text-sm text-slate-500">Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} entries</div>
        <div className="flex gap-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /> Previous</button>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next <ChevronRight size={16} /></button>
        </div>
      </div>

      {/* DELETE CONFIRMATION */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Confirm Deletion</h2>
              <button onClick={() => setProductToDelete(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6">Are you sure you want to delete "<span className="font-semibold text-slate-800">{productToDelete.name}</span>"? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setProductToDelete(null)} disabled={deleteProductMutation.isPending} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={confirmDelete} disabled={deleteProductMutation.isPending} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {deleteProductMutation.isPending ? <RefreshCcw size={14} className="animate-spin" /> : <Trash2 size={14} />} {deleteProductMutation.isPending ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Create New Product</h2>
              <button onClick={closeAddModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitNew} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Name</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Code / SKU</label><input type="text" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category</label><input type="text" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Gender</label>
                  <select value={form.gender} onChange={(e) => setForm({...form, gender: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500 bg-white">
                    <option value="">No Gender / Unisex</option>
                    {allowedGenders.map((/** @type {string} */ g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Price ($)</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Discount ($)</label><input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({...form, discount: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Stock Qty</label><input type="number" value={form.stock} onChange={(e) => setForm({...form, stock: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Image</label>
                <div className="flex items-center gap-4 border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="w-16 h-16 bg-white border border-slate-200 rounded overflow-hidden shrink-0 flex items-center justify-center">
                    {form.imagePreview ? <img src={form.imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, false)} className="w-full text-sm text-slate-600 file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" onClick={closeAddModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">Cancel</button>
                <button type="submit" disabled={addProductMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {addProductMutation.isPending && <RefreshCcw size={14} className="animate-spin" />} {addProductMutation.isPending ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Edit Product</h2>
              <button onClick={closeEditModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Name</label><input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Code / SKU</label><input type="text" value={editForm.code} onChange={(e) => setEditForm({...editForm, code: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category</label><input type="text" value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Gender</label>
                  <select value={editForm.gender} onChange={(e) => setEditForm({...editForm, gender: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500 bg-white">
                    <option value="">No Gender / Unisex</option>
                    {allowedGenders.map((/** @type {string} */ g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Price ($)</label><input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm({...editForm, price: e.target.value})} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Discount ($)</label><input type="number" step="0.01" value={editForm.discount} onChange={(e) => setEditForm({...editForm, discount: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Stock Qty</label><input type="number" value={editForm.stock} onChange={(e) => setEditForm({...editForm, stock: e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-slate-500" /></div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Image</label>
                <div className="flex items-center gap-4 border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="w-16 h-16 bg-white border border-slate-200 rounded overflow-hidden shrink-0 flex items-center justify-center">
                    {editForm.imagePreview ? <img src={editForm.imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, true)} className="w-full text-sm text-slate-600 file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" onClick={closeEditModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">Cancel</button>
                <button type="submit" disabled={updateProductMutation.isPending} className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {updateProductMutation.isPending && <RefreshCcw size={14} className="animate-spin" />} {updateProductMutation.isPending ? 'Saving...' : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}