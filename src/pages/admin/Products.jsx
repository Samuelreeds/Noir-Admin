// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { RefreshCcw, Download, Search, Plus, Trash2, Edit, X, ChevronLeft, ChevronRight, Package, Filter, UploadCloud, Save, Info } from 'lucide-react';
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

export default function Products() {
  const [view, setView] = useState('list'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState(/** @type {string[]} */ ([]));
  const [productToDelete, setProductToDelete] = useState(/** @type {{id: string, name: string} | null} */ (null));
  
  const [activeTopTab, setActiveTopTab] = useState('General Info');
  const [activeLangTab, setActiveLangTab] = useState('english'); 

  const TOP_TABS = ["General Info", "Description", "How it works", "Key Ingredients", "FAQs"];

  const queryClient = useQueryClient();

  const defaultForm = { 
    id: null, name: '', name_khmer: '', code: '', overview: '', overview_khmer: '', 
    product_type: '', tags: '', is_best_seller: false, product_set: '', 
    show_in_search: true, is_promotion: false, featured: false, status: true, 
    release_date: '', ordering: 0, category_list: /** @type {string[]} */ ([]), 
    images: /** @type {string[]} */ ([]), imageFiles: /** @type {File[]} */ ([]),
    variants: [{ id: null, sku: '', size: '', scent: '', price: '', discount_price: '', cost: '', is_active: true }]
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

  const { data: dbProductTypes = [] } = useQuery({
    queryKey: ['admin-product-types-list'],
    queryFn: async () => {
      const { data } = await supabase.from('product_types').select('*');
      return data || [];
    }
  });

  // Fetch products WITH their nested variants
  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products-variants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // MUTATIONS
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Please fill in the product name.");
      if (form.variants.length === 0) throw new Error("A product must have at least one variant.");
      if (form.variants.some(v => !v.sku || !v.price)) throw new Error("All variants must have a SKU and Price.");

      // Image Handling
      let uploadedUrls = /** @type {string[]} */ ([]);
      if (form.imageFiles.length > 0) {
        uploadedUrls = await Promise.all(form.imageFiles.map(file => uploadImageToSupabase(file)));
      }
      const finalImages = [...form.images.filter(url => !url.startsWith('blob:')), ...uploadedUrls];
      const primaryImage = finalImages.length > 0 ? finalImages[0] : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80';

      // 1. Save Base Product
      const productPayload = {
        name: form.name, name_khmer: form.name_khmer || null, code: form.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        overview: form.overview || null, overview_khmer: form.overview_khmer || null,
        product_type: form.product_type || null, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        is_best_seller: form.is_best_seller, product_set: form.product_set || null, show_in_search: form.show_in_search,
        is_promotion: form.is_promotion, featured: form.featured, status: form.status ? 'active' : 'inactive',
        release_date: form.release_date || null, ordering: parseInt(form.ordering.toString()) || 0,
        category: form.category_list.join(', ') || 'General', image: primaryImage, images: finalImages.length > 0 ? finalImages : null
      };

      let finalProductId = form.id;
      if (finalProductId) {
        const { error } = await supabase.from('products').update(productPayload).eq('id', finalProductId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('products').insert([productPayload]).select('id').single();
        if (error) throw error;
        finalProductId = data.id;
      }

      // 2. Save Associated Variants
      const variantsPayload = form.variants.map(v => {
        const variantObj = {
          product_id: finalProductId,
          sku: v.sku,
          size: v.size || null,
          scent: v.scent || null,
          price: parseFloat(v.price) || 0,
          discount_price: v.discount_price ? parseFloat(v.discount_price) : null,
          cost: parseFloat(v.cost) || 0,
          is_active: v.is_active
        };
        
        // FIXED: Only include ID if it is explicitly NOT null.
        // This prevents the "violates not-null constraint" DB error on new variants.
        if (v.id) {
          variantObj.id = v.id;
        }
        
        return variantObj;
      });

      // Upsert variants (Updates existing IDs, inserts new ones)
      const { error: variantsError } = await supabase.from('product_variants').upsert(variantsPayload, { onConflict: 'id' });
      if (variantsError) throw variantsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-variants-list'] });
      setView('list');
      setForm(defaultForm);
    },
    onError: (err) => alert("Error saving product: " + err.message)
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-variants-list'] });
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
    // Legacy migration safeguard: If product has no variants in DB, build one from its old flat fields
    let mappedVariants = p.product_variants || [];
    if (mappedVariants.length === 0) {
      mappedVariants = [{
        id: null, sku: `${p.code}-01`, size: p.sizes ? String(p.sizes) : '', scent: '', 
        price: p.price || '', discount_price: p.discount || '', cost: '0', is_active: true
      }];
    }

    setForm({
      ...defaultForm,
      id: p.id, name: p.name || '', name_khmer: p.name_khmer || '', code: p.code || '', 
      overview: p.overview || '', overview_khmer: p.overview_khmer || '', 
      product_type: p.product_type || '', tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''), 
      is_best_seller: !!p.is_best_seller, product_set: p.product_set || '', 
      show_in_search: p.show_in_search !== false, is_promotion: !!p.is_promotion, 
      featured: !!p.featured, status: p.status !== 'inactive', 
      release_date: p.release_date ? p.release_date.substring(0, 16) : '', ordering: p.ordering || 0,
      category_list: p.category ? p.category.split(',').map((/** @type {string} */ s) => s.trim()) : [],
      images: p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
      imageFiles: [],
      variants: mappedVariants
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

  // VARIANT HANDLERS
  const addVariant = () => {
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, { id: null, sku: `${prev.code || 'SKU'}-${prev.variants.length + 1}`, size: '', scent: '', price: '', discount_price: '', cost: '0', is_active: true }]
    }));
  };

  const updateVariant = (/** @type {number} */ index, /** @type {string} */ field, /** @type {any} */ value) => {
    setForm(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const removeVariant = (/** @type {number} */ index) => {
    setForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 relative flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      
      {/* -------------------- LIST VIEW -------------------- */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
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
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4 text-center">Variants</th>
                  <th className="px-6 py-4 text-right">Base Price</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading products...</td></tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  paginatedProducts.map((/** @type {any} */ p) => {
                    const isActive = p.status !== 'inactive';
                    const isSelected = selectedProductIds.includes(p.id);
                    const variantCount = p.product_variants ? p.product_variants.length : 0;
                    const basePrice = p.product_variants?.[0]?.price || p.price || 0;

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
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold">
                            {variantCount} SKUs
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">From ${basePrice.toFixed(2)}</td>
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
        </div>
      )}

      {/* -------------------- FORM VIEW (CREATE / EDIT) -------------------- */}
      {view === 'form' && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 duration-300">
          
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

          <div className="p-6 md:p-8 flex-1 w-full max-w-[1400px] mx-auto space-y-8">
            
            {/* BASE INFO SECTION */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
              {/* LEFT COLUMN: Identity & Images */}
              <div className="w-full md:w-1/2 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-200 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Product Identity</h3>
                
                <div className="flex gap-2 border-b border-slate-200 pb-2">
                  <button type="button" onClick={() => setActiveLangTab('english')} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeLangTab === 'english' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>English</button>
                  <button type="button" onClick={() => setActiveLangTab('khmer')} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeLangTab === 'khmer' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Khmer</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Base Code</label><input type="text" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} placeholder="e.g., GC-001" className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 font-mono" /></div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Type</label>
                    <select value={form.product_type} onChange={(e) => setForm({...form, product_type: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm bg-white outline-none focus:border-slate-500">
                      <option value="">Select Type...</option>
                      {dbProductTypes.map((/** @type {any} */ pt) => <option key={pt.id || pt.name} value={pt.title || pt.name}>{pt.title || pt.name}</option>)}
                    </select>
                  </div>
                </div>
                
                {activeLangTab === 'english' ? (
                  <>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Name (English)</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Overview (English)</label><textarea value={form.overview} onChange={(e) => setForm({...form, overview: e.target.value})} rows={3} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 resize-none" /></div>
                  </>
                ) : (
                  <>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Name (Khmer)</label><input type="text" value={form.name_khmer} onChange={(e) => setForm({...form, name_khmer: e.target.value})} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>
                    <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Overview (Khmer)</label><textarea value={form.overview_khmer} onChange={(e) => setForm({...form, overview_khmer: e.target.value})} rows={3} className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500 resize-none" /></div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Product Images (720 x 960 px)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative flex flex-col items-center justify-center min-h-[140px]">
                    <UploadCloud size={24} className="text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">Drag & Drop images</p>
                    <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  </div>
                  {form.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {form.images.map((imgUrl, idx) => (
                        <div key={idx} className="relative aspect-[3/4] rounded overflow-hidden border border-slate-200 bg-slate-50 group">
                          <img src={imgUrl} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-white/80 hover:bg-white text-rose-500 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Settings & Categories */}
              <div className="w-full md:w-1/2 p-6 md:p-8 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Organization & Settings</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-3">Categories</label>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded border border-slate-200 h-[140px] overflow-y-auto">
                    {dbCategories.map((/** @type {any} */ cat) => (
                      <label key={cat.title || cat.name} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          checked={form.category_list.includes(cat.title || cat.name)}
                          onChange={(e) => {
                            const val = cat.title || cat.name;
                            if (e.target.checked) setForm({...form, category_list: [...form.category_list, val]});
                            else setForm({...form, category_list: form.category_list.filter(c => c !== val)});
                          }}
                        />
                        <span className="text-sm text-slate-700 truncate">{cat.title || cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Search Tags</label><input type="text" value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="tag-1, tag-2..." className="w-full border border-slate-300 rounded p-3 text-sm outline-none focus:border-slate-500" /></div>

                <div className="space-y-4 pt-2">
                  <ToggleSwitch labelLeft="Active Status" label={form.status ? 'Published' : 'Hidden'} checked={form.status} onChange={v => setForm({...form, status: v})} />
                  <ToggleSwitch labelLeft="Best Seller Badge" label={form.is_best_seller ? 'Yes' : 'No'} checked={form.is_best_seller} onChange={v => setForm({...form, is_best_seller: v})} />
                  <ToggleSwitch labelLeft="Featured Item" label={form.featured ? 'Yes' : 'No'} checked={form.featured} onChange={v => setForm({...form, featured: v})} />
                </div>
              </div>
            </div>

            {/* --- STRICT REPORT VARIANT SECTION --- */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold uppercase tracking-wider">Product Variants (SKUs)</h3>
                  <p className="text-xs text-slate-300 mt-1 font-mono flex items-center gap-1.5"><Info size={12}/> Inventory quantities are managed securely via the Warehouse Ledger.</p>
                </div>
                <button type="button" onClick={addVariant} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded text-sm font-bold hover:bg-slate-100 transition-colors">
                  <Plus size={16} /> Add Variant
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs w-[180px]">SKU / Barcode</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs">Size / Volume</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs">Scent</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs w-[120px]">Price ($)</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs w-[120px]">Cost ($)</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs text-center w-[80px]">Active</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 uppercase text-xs text-right w-[60px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {form.variants.map((variant, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <input type="text" value={variant.sku} onChange={(e) => updateVariant(index, 'sku', e.target.value)} placeholder="SKU Code" className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-slate-500 mb-1" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={variant.size} onChange={(e) => updateVariant(index, 'size', e.target.value)} placeholder="e.g. 500ml" className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-500" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={variant.scent} onChange={(e) => updateVariant(index, 'scent', e.target.value)} placeholder="e.g. Lavender" className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-500" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" step="0.01" value={variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value)} placeholder="0.00" className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-slate-500" required />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" step="0.01" value={variant.cost} onChange={(e) => updateVariant(index, 'cost', e.target.value)} placeholder="0.00" className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-slate-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={variant.is_active} onChange={(e) => updateVariant(index, 'is_active', e.target.checked)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => removeVariant(index)} className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Remove Variant" disabled={form.variants.length === 1}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
              <p className="text-sm text-slate-500 mb-8">Are you sure you want to delete "<span className="font-semibold text-slate-800">{productToDelete.name}</span>"? This will also delete all associated variants.</p>
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