import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Package, Filter, UploadCloud, Save } from 'lucide-react';
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
        const MAX_WIDTH = 1200; const MAX_HEIGHT = 1200;
        let { width, height } = img;
        if (width > height && width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
        else if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Failed to get canvas context"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas conversion failed'));
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }));
        }, 'image/webp', 0.85);
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

// --- REUSABLE TOGGLE SWITCH ---
/**
 * @param {{ checked: boolean, onChange: (val: boolean) => void, label?: string, labelLeft?: string }} props
 */
const ToggleSwitch = ({ checked, onChange, label = '', labelLeft = '' }) => (
  <div className="flex items-center justify-between">
    {labelLeft && <span className="text-sm font-semibold text-slate-800">{labelLeft}</span>}
    <label className="inline-flex items-center cursor-pointer shrink-0">
      {label && <span className="mr-3 text-sm font-medium text-slate-500 whitespace-nowrap select-none">{label}</span>}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="relative w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
    </label>
  </div>
);

// --- MAIN COMPONENT ---
export default function Products() {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState(/** @type {string[]} */ ([]));
  const [productToDelete, setProductToDelete] = useState(/** @type {{id: string, name: string} | null} */ (null));
  
  // UI Tabs State
  const [activeTopTab, setActiveTopTab] = useState('General Info');
  const [activeLangTab, setActiveLangTab] = useState('english'); // 'english' | 'khmer'

  const TOP_TABS = ["General Info", "Product Option", "Description", "How it works", "Key Ingredients", "Results", "FAQs", "Shipping", "Return Policy"];

  const queryClient = useQueryClient();

  const defaultForm = { 
    id: null, name: '', name_khmer: '', code: '', overview: '', overview_khmer: '', 
    price: '', discount: '', product_type: '', sizes: '', stock: '', tags: '',
    is_best_seller: false, product_set: '', show_in_search: true, is_promotion: false, 
    featured: false, status: true, release_date: '', ordering: 0,
    category_list: /** @type {string[]} */ ([]), // Array for checkboxes
    images: /** @type {string[]} */ ([]), // URLs
    imageFiles: /** @type {File[]} */ ([]) // Files to upload
  };
  
  const [form, setForm] = useState(defaultForm);

  // FETCH DATA
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['admin-categories-list'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('title, name').eq('status', true);
      return data || [];
    }
  });

  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // MUTATIONS
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.price) throw new Error("Please fill in the product name and price.");

      let uploadedUrls = /** @type {string[]} */ ([]);
      if (form.imageFiles.length > 0) {
        uploadedUrls = await Promise.all(form.imageFiles.map(file => uploadImageToSupabase(file)));
      }

      const finalImages = [
        ...form.images.filter(url => !url.startsWith('blob:')),
        ...uploadedUrls
      ];

      const primaryImage = finalImages.length > 0 ? finalImages[0] : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80';

      const payload = {
        name: form.name,
        name_khmer: form.name_khmer || null,
        code: form.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        overview: form.overview || null,
        overview_khmer: form.overview_khmer || null,
        price: parseFloat(form.price) || 0,
        discount: parseFloat(form.discount) || 0,
        stock: parseInt(form.stock) || 0,
        product_type: form.product_type || null,
        // FIX: If the DB column is an array, we must pass it as an array (or null if empty)
        sizes: form.sizes ? [form.sizes] : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        is_best_seller: form.is_best_seller,
        product_set: form.product_set || null,
        show_in_search: form.show_in_search,
        is_promotion: form.is_promotion,
        featured: form.featured,
        status: form.status ? 'active' : 'inactive',
        release_date: form.release_date || null,
        ordering: parseInt(form.ordering.toString()) || 0,
        category: form.category_list.join(', ') || 'General',
        image: primaryImage,
        images: finalImages.length > 0 ? finalImages : null
      };

      if (form.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-list'] });
      setView('list');
      setForm(defaultForm);
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

  // HANDLERS
  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryFilter]);

  const categories = ['All Categories', ...new Set(products.map((/** @type {any} */ p) => p.category).filter(Boolean).map((/** @type {string} */ c) => c.split(',')[0].trim()))];

  const filteredProducts = products.filter((/** @type {any} */ p) => {
    if (categoryFilter !== 'All Categories' && !p.category?.includes(categoryFilter)) return false;
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
    setForm({
      ...defaultForm,
      id: p.id, name: p.name || '', name_khmer: p.name_khmer || '', code: p.code || '', 
      overview: p.overview || '', overview_khmer: p.overview_khmer || '', 
      price: p.price?.toString() || '', discount: p.discount?.toString() || '', 
      product_type: p.product_type || '', 
      // FIX: Unwrap arrays back to strings for the edit form inputs
      sizes: Array.isArray(p.sizes) ? (p.sizes[0] || '') : (p.sizes || ''), 
      stock: p.stock?.toString() || '0', 
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''), 
      is_best_seller: !!p.is_best_seller, product_set: p.product_set || '', 
      show_in_search: p.show_in_search !== false, is_promotion: !!p.is_promotion, 
      featured: !!p.featured, status: p.status !== 'inactive', 
      release_date: p.release_date ? p.release_date.substring(0, 16) : '', ordering: p.ordering || 0,
      category_list: p.category ? p.category.split(',').map((/** @type {string} */ s) => s.trim()) : [],
      images: p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
      imageFiles: []
    });
    setActiveTopTab('General Info');
    setView('form');
  };

  const handleFilesChange = (/** @type {any} */ e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPreviewUrls = files.map(f => URL.createObjectURL(/** @type {File} */ (f)));
    setForm(prev => ({
      ...prev,
      imageFiles: [...prev.imageFiles, .../** @type {File[]} */ (files)],
      images: [...prev.images, ...newPreviewUrls]
    }));
  };

  const removeImage = (/** @type {number} */ index) => {
    setForm(prev => {
      const newImages = [...prev.images];
      const newFiles = [...prev.imageFiles];
      const removedUrl = newImages.splice(index, 1)[0];
      
      if (removedUrl.startsWith('blob:')) {
        newFiles.splice(index - (prev.images.length - prev.imageFiles.length), 1);
        URL.revokeObjectURL(removedUrl);
      }
      return { ...prev, images: newImages, imageFiles: newFiles };
    });
  };

  const exportToCSV = () => {
    const listToExport = selectedProductIds.length > 0 ? products.filter((/** @type {any} */ p) => selectedProductIds.includes(p.id)) : filteredProducts;
    if (listToExport.length === 0) return alert("No data to export!");
    const headers = ['Product Code', 'Product Name', 'Category', 'Price', 'Discount', 'Stock', 'Status'];
    const rows = listToExport.map((/** @type {any} */ p) => [
      p.code || 'N/A', p.name || 'N/A', p.category || 'N/A', p.price || 0, p.discount || 0, p.stock, p.status || 'ACTIVE'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      
      {/* -------------------- LIST VIEW -------------------- */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 shrink-0">
            <div className="flex gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products by name or code..." className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full outline-none focus:border-slate-500 bg-white" />
              </div>
              <div className="relative shrink-0 w-48">
                 <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-slate-300 rounded pl-9 pr-4 py-2 text-sm w-full bg-white outline-none focus:border-slate-500 appearance-none cursor-pointer">
                   {categories.map((/** @type {any} */ cat) => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors bg-white"><RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh</button>
              <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors bg-white"><Download size={14} /> {selectedProductIds.length > 0 ? `Export (${selectedProductIds.length})` : 'Export Excel'}</button>
              <button onClick={() => { setForm(defaultForm); setView('form'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Create Product</button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-10"><input type="checkbox" checked={paginatedProducts.length > 0 && selectedProductIds.length === paginatedProducts.length} onChange={toggleSelectAll} className="rounded border-slate-300 cursor-pointer"/></th>
                  <th className="px-6 py-4">Product Code</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4 text-right">Price($)</th>
                  <th className="px-6 py-4 text-right">Discount($)</th>
                  <th className="px-6 py-4 text-center">Product Stock</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Loading products...</td></tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  paginatedProducts.map((/** @type {any} */ p) => {
                    const isActive = p.status !== 'inactive';
                    const isOutOfStock = p.stock <= 0;
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/50 ${isSelected ? 'bg-slate-50' : ''}`}>
                        <td className="px-6 py-4"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="rounded border-slate-300 cursor-pointer"/></td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{p.code || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Package size={18} /></div>}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 block">{p.name}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{p.category}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">${p.price?.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-slate-600">${p.discount?.toFixed(2) || '0.00'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium border ${isOutOfStock ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {isOutOfStock ? 'Out of Stock' : `${p.stock} In-Stock`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button onClick={() => handleEditOpen(p)} className="p-1.5 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300 rounded" title="Edit"><Edit size={16} /></button>
                            <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 hover:text-red-600 transition-colors border border-transparent hover:border-slate-300 rounded" title="Delete"><Trash2 size={16} /></button>
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
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} entries</div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /> Previous</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- FORM VIEW (CREATE / EDIT) -------------------- */}
      {view === 'form' && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 duration-300">
          
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20 shrink-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">{form.id ? 'EDIT PRODUCT' : 'CREATE PRODUCT'}</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded font-medium text-sm hover:bg-rose-600 transition-colors">
                <X size={16} /> Discard
              </button>
              <button onClick={() => saveProductMutation.mutate()} disabled={saveProductMutation.isPending} className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                {saveProductMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                Save Product
              </button>
            </div>
          </div>

          {/* Top Tabs */}
          <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto custom-scrollbar shrink-0">
            <div className="flex whitespace-nowrap min-w-max">
              {TOP_TABS.map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTopTab(tab)}
                  className={`px-5 py-4 text-sm font-medium border-b-2 transition-colors ${activeTopTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6 md:p-8 flex-1 w-full max-w-[1400px] mx-auto">
            {activeTopTab === 'General Info' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                
                {/* LEFT COLUMN */}
                <div className="w-full md:w-1/2 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-200 space-y-6">
                  
                  {/* Language Sub-tabs */}
                  <div className="flex gap-2 border-b border-slate-200 pb-2">
                    <button type="button" onClick={() => setActiveLangTab('english')} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeLangTab === 'english' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>English</button>
                    <button type="button" onClick={() => setActiveLangTab('khmer')} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeLangTab === 'khmer' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Khmer</button>
                  </div>

                  <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Code</label><input type="text" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} placeholder="Enter product code" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                  
                  {activeLangTab === 'english' ? (
                    <>
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Name (English)</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Enter English Title" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Overview (English)</label><textarea value={form.overview} onChange={(e) => setForm({...form, overview: e.target.value})} placeholder="Enter text..." rows={4} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 resize-none" /></div>
                    </>
                  ) : (
                    <>
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Name (Khmer)</label><input type="text" value={form.name_khmer} onChange={(e) => setForm({...form, name_khmer: e.target.value})} placeholder="បញ្ចូលឈ្មោះផលិតផល" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Overview (Khmer)</label><textarea value={form.overview_khmer} onChange={(e) => setForm({...form, overview_khmer: e.target.value})} placeholder="បញ្ចូលអត្ថបទពិពណ៌នា..." rows={4} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 resize-none" /></div>
                    </>
                  )}

                  {/* Multi-Image Uploader */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Images (720 x 960 px)</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative flex flex-col items-center justify-center min-h-[160px]">
                      <UploadCloud size={32} className="text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Drag & Drop your images here or <span className="text-blue-600 underline cursor-pointer">Browse</span></p>
                      <p className="text-xs text-slate-400 mt-1">You can upload multiple images at once</p>
                      <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    </div>
                    {/* Image Preview Grid */}
                    {form.images.length > 0 && (
                      <div className="grid grid-cols-4 gap-3 mt-4">
                        {form.images.map((imgUrl, idx) => (
                          <div key={idx} className="relative aspect-[3/4] rounded overflow-hidden border border-slate-200 bg-slate-50 group">
                            <img src={imgUrl} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-white/80 hover:bg-white text-rose-500 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Checkboxes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-3">Category</label>
                    <div className="space-y-3">
                      {dbCategories.map((/** @type {any} */ cat) => (
                        <label key={cat.title || cat.name} className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            checked={form.category_list.includes(cat.title || cat.name)}
                            onChange={(e) => {
                              const val = cat.title || cat.name;
                              if (e.target.checked) setForm({...form, category_list: [...form.category_list, val]});
                              else setForm({...form, category_list: form.category_list.filter(c => c !== val)});
                            }}
                          />
                          <span className="text-sm text-slate-700">{cat.title || cat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN */}
                <div className="w-full md:w-1/2 p-6 md:p-8 space-y-6">
                  
                  <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Price ($)</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} placeholder="Enter product price" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                  <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Discount ($)</label><input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({...form, discount: e.target.value})} placeholder="Enter product discount" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Type</label>
                    <select value={form.product_type} onChange={(e) => setForm({...form, product_type: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500">
                      <option value="">Select Product Type...</option>
                      <option value="Merchandise">Merchandise</option>
                      <option value="Cosmetics">Cosmetics</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Sizes</label>
                    <select value={form.sizes} onChange={(e) => setForm({...form, sizes: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500">
                      <option value="">Select size...</option>
                      <option value="S">Small (S)</option>
                      <option value="M">Medium (M)</option>
                      <option value="L">Large (L)</option>
                      <option value="OS">One Size (OS)</option>
                    </select>
                  </div>

                  <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Quantity</label><input type="number" value={form.stock} onChange={(e) => setForm({...form, stock: e.target.value})} placeholder="Enter product quantity" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                  
                  <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Tags</label><input type="text" value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="Example: tag-1, tag-2, tag-3, ..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>

                  <div className="space-y-4 pt-2">
                    <ToggleSwitch labelLeft="Best Sellers" label={form.is_best_seller ? 'Checked' : 'Unchecked'} checked={form.is_best_seller} onChange={v => setForm({...form, is_best_seller: v})} />
                    
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Set</label><input type="text" value={form.product_set} onChange={(e) => setForm({...form, product_set: e.target.value})} placeholder="Enter set number (e.g., 1, 2, 3...)" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>

                    <ToggleSwitch labelLeft="Show in Searching" label={form.show_in_search ? 'Show' : 'Hide'} checked={form.show_in_search} onChange={v => setForm({...form, show_in_search: v})} />
                    <ToggleSwitch labelLeft="Promotion" label={form.is_promotion ? 'Checked' : 'Unchecked'} checked={form.is_promotion} onChange={v => setForm({...form, is_promotion: v})} />
                    <ToggleSwitch labelLeft="Featured (Community Favourites)" label={form.featured ? 'Checked' : 'Unchecked'} checked={form.featured} onChange={v => setForm({...form, featured: v})} />
                    <ToggleSwitch labelLeft="Status" label={form.status ? 'Active' : 'Inactive'} checked={form.status} onChange={v => setForm({...form, status: v})} />
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Release Date/Time</label>
                      <input type="datetime-local" value={form.release_date} onChange={(e) => setForm({...form, release_date: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500" />
                      <p className="text-xs text-slate-400 mt-2">Set a future date/time to schedule product release. Leave empty for immediate availability.</p>
                    </div>

                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Ordering</label><input type="number" value={form.ordering} onChange={(e) => setForm({...form, ordering: parseInt(e.target.value) || 0})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                  </div>

                </div>
              </div>
            )}

            {/* PLACEHOLDER TABS */}
            {activeTopTab !== 'General Info' && (
               <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 max-w-2xl mx-auto mt-10">
                 <p className="text-slate-500 font-medium text-lg">The {activeTopTab} module is under development.</p>
                 <p className="text-sm text-slate-400 mt-2">Check back soon.</p>
               </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-rose-500" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Product?</h2>
              <p className="text-sm text-slate-500 mb-8">Are you sure you want to delete "<span className="font-semibold text-slate-800">{productToDelete.name}</span>"?</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setProductToDelete(null)} disabled={deleteProductMutation.isPending} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">Cancel</button>
                <button onClick={confirmDelete} disabled={deleteProductMutation.isPending} className="px-5 py-2.5 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors w-full flex items-center justify-center gap-2">
                  {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}