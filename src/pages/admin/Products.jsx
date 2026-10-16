// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, Download, Search, Plus, Trash2, Edit, X, Package, 
  Filter, UploadCloud, Save, Info, AlertTriangle, ImagePlus, 
  CheckCircle2, ChevronDown, AlignLeft, ChevronLeft, MapPin 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 20;

// --- IMAGE PROCESSING & UPLOAD HELPERS ---
const processImageToWebP = (/** @type {File} */ file) => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error("File too large. Max 10MB."));
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
        if (!ctx) return reject(new Error("Canvas context failed"));
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
  const { error } = await supabase.storage.from('product-images').upload(filePath, processedFile);
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
  return data.publicUrl;
};

// --- UI COMPONENTS ---
const ToggleSwitch = ({ checked, onChange, label = '', labelLeft = '' }) => (
  <div className="flex items-center justify-between py-1">
    {labelLeft && <span className="text-sm font-semibold text-slate-700">{labelLeft}</span>}
    <label className="inline-flex items-center cursor-pointer shrink-0">
      {label && <span className="mr-3 text-xs font-medium text-slate-500 select-none">{label}</span>}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="relative w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
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
  
  const [imagePickerVariantIndex, setImagePickerVariantIndex] = useState(/** @type {number | null} */ (null));

  const TOP_TABS = ["General Info", "Product Options", "Content Details"];

  const queryClient = useQueryClient();

  const defaultForm = { 
    id: null, name: '', name_khmer: '', code: '', overview: '', overview_khmer: '', 
    product_type: '', tags: '', is_best_seller: false, product_set: '', 
    show_in_search: true, is_promotion: false, featured: false, status: true, 
    ordering: 0, category_list: /** @type {string[]} */ ([]), 
    
    // Unified File Handling: All raw files go here
    newUploads: /** @type {{blobUrl: string, file: File}[]} */ ([]), 
    images: /** @type {string[]} */ ([]), // Array of strings (Supa URLs or blob URLs)
    
    description: '', description_khmer: '', how_it_works: '', how_it_works_khmer: '',
    key_ingredients: '', key_ingredients_khmer: '', faqs: '', faqs_khmer: '',
    variant_label: 'Size', 
    variants: [{ 
      id: null, name: '', sku: '', attribute_value: '', size: '', scent: '', price: '', 
      discount_price: '', cost: '', ordering: 0, is_active: true, stock_balance: 0,
      images: /** @type {string[]} */ ([]), 
    }]
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

  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products-variants-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*, product_variants(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: stockBalances = {} } = useQuery({
    queryKey: ['admin-variant-stock-balances', form.id],
    enabled: !!form.id,
    queryFn: async () => {
      if (!form.id) return {};
      const { data, error } = await supabase
        .from('variant_stock_balances')
        .select('variant_id, on_hand, available');
      
      if (error) throw error;
      const balancesMap = {};
      data?.forEach(b => { balancesMap[b.variant_id] = b; });
      return balancesMap;
    }
  });

  // MUTATIONS
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Product name is required.");
      if (form.variants.length === 0) throw new Error("At least one variant is required.");
      if (form.variants.some(v => !v.sku || !v.price)) throw new Error("All variants require a SKU and Price.");

      // 1. Upload newly added files exactly once
      const allReferencedUrls = new Set([
        ...form.images,
        ...form.variants.flatMap(v => v.images || [])
      ]);
      const activeUploads = (form.newUploads || []).filter(item => allReferencedUrls.has(item.blobUrl));
      
      const blobToUrlMap = {};
      for (const item of activeUploads) {
        blobToUrlMap[item.blobUrl] = await uploadImageToSupabase(item.file);
      }

      // Helper to replace temporary blob URLs with final cloud URLs
      const mapUrls = (/** @type {string[]} */ urls) => (urls || [])
        .map(url => url.startsWith('blob:') ? blobToUrlMap[url] : url)
        .filter(Boolean);

      const finalImages = mapUrls(form.images);
      const primaryImage = finalImages.length > 0 ? finalImages[0] : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80';

      // 2. Save Parent Product
      const productPayload = {
        name: form.name, name_khmer: form.name_khmer || null, code: form.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        overview: form.overview || null, overview_khmer: form.overview_khmer || null,
        product_type: form.product_type || null, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        is_best_seller: form.is_best_seller, product_set: form.product_set || null, show_in_search: form.show_in_search,
        is_promotion: form.is_promotion, featured: form.featured, status: form.status ? 'active' : 'inactive',
        ordering: parseInt(form.ordering.toString()) || 0,
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

      // 3. Process Variants
      const variantsToUpdate = [];
      const variantsToInsert = [];
      const currentVariantIds = [];

      for (let i = 0; i < form.variants.length; i++) {
        const v = form.variants[i];
        const vFinalImages = mapUrls(v.images);

        const variantObj = {
          product_id: finalProductId,
          sku: v.sku,
          size: v.attribute_value || v.size || null, 
          scent: v.name || v.scent || null, 
          price: parseFloat(v.price) || 0,
          discount_price: v.discount_price ? parseFloat(v.discount_price) : null,
          cost: parseFloat(v.cost) || 0,
          is_active: v.is_active,
          images: vFinalImages.length > 0 ? vFinalImages : null
        };
        
        if (v.id) {
          variantsToUpdate.push({ ...variantObj, id: v.id });
          currentVariantIds.push(v.id);
        } else {
          variantsToInsert.push(variantObj);
        }
      }

      // Soft delete removed variants
      if (form.id) {
        const { data: existingVariants, error: fetchErr } = await supabase.from('product_variants').select('id').eq('product_id', finalProductId);
        if (!fetchErr && existingVariants) {
          const variantsToArchive = existingVariants.map(ev => ev.id).filter(id => !currentVariantIds.includes(id));
          if (variantsToArchive.length > 0) {
            const { error: archiveError } = await supabase.from('product_variants').update({ is_active: false }).in('id', variantsToArchive);
            if (archiveError) throw archiveError;
          }
        }
      }

      if (variantsToUpdate.length > 0) {
        const { error } = await supabase.from('product_variants').upsert(variantsToUpdate, { onConflict: 'id' });
        if (error) throw new Error(error.code === '23505' ? 'Duplicate SKU detected.' : error.message);
      }
      if (variantsToInsert.length > 0) {
        const { error } = await supabase.from('product_variants').insert(variantsToInsert);
        if (error) throw new Error(error.code === '23505' ? 'Duplicate SKU detected.' : error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-variants-list'] });
      setView('list');
      setForm(defaultForm);
    },
    onError: (err) => alert("Save Error: " + err.message)
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-variants-list'] });
      setProductToDelete(null); 
    }
  });

  // HANDLERS
  const handleEditOpen = (/** @type {any} */ p) => {
    let mappedVariants = p.product_variants || [];
    if (!Array.isArray(mappedVariants)) mappedVariants = [mappedVariants];
    if (mappedVariants.length === 0) mappedVariants = [{...defaultForm.variants[0], sku: `${p.code || 'SKU'}-01`}];

    let parsedImages = [];
    if (Array.isArray(p.images)) {
        parsedImages = p.images.filter(img => typeof img === 'string');
    } else if (typeof p.images === 'string') {
        try { 
            const parsed = JSON.parse(p.images); 
            parsedImages = Array.isArray(parsed) ? parsed : [p.images];
        } catch(e) { parsedImages = [p.images]; }
    } else if (p.image && typeof p.image === 'string') {
        parsedImages = [p.image];
    }

    let catList = [];
    if (Array.isArray(p.category)) {
        catList = p.category.map(String);
    } else if (typeof p.category === 'string') {
        catList = p.category.split(',').map(s => s.trim()).filter(Boolean);
    }

    setForm({
      ...defaultForm,
      id: p.id, 
      name: p.name || '', 
      name_khmer: p.name_khmer || '', 
      code: p.code || '', 
      overview: p.overview || '', 
      overview_khmer: p.overview_khmer || '', 
      product_type: p.product_type || '', 
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''), 
      is_best_seller: !!p.is_best_seller, 
      product_set: p.product_set || '', 
      show_in_search: p.show_in_search !== false, 
      is_promotion: !!p.is_promotion, 
      featured: !!p.featured, 
      status: p.status !== 'inactive', 
      ordering: p.ordering || 0,
      category_list: catList,
      images: parsedImages,
      newUploads: [],
      variants: mappedVariants.map((/** @type {any} */ v) => {
          let vImgs = [];
          if (Array.isArray(v.images)) vImgs = v.images.filter(img => typeof img === 'string');
          else if (typeof v.images === 'string') {
              try { 
                  const parsed = JSON.parse(v.images); 
                  vImgs = Array.isArray(parsed) ? parsed : [v.images];
              } catch(e) { vImgs = [v.images]; }
          }
          return {
              id: v.id,
              name: v.scent || '', 
              sku: v.sku || '',
              attribute_value: v.size || v.attribute_value || '', 
              size: v.size || '',
              scent: v.scent || '',
              price: v.price !== null && v.price !== undefined ? v.price : '',
              discount_price: v.discount_price !== null && v.discount_price !== undefined ? v.discount_price : '',
              cost: v.cost !== null && v.cost !== undefined ? v.cost : '',
              ordering: v.ordering || 0,
              is_active: v.is_active !== false,
              stock_balance: 0, 
              images: vImgs
          };
      })
    });
    setActiveTopTab('General Info');
    setView('form');
  };

  const handleParentFilesChange = (/** @type {any} */ e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newItems = files.map(f => ({ file: f, blobUrl: URL.createObjectURL(/** @type {File} */ (f)) }));
    
    setForm(prev => ({ 
      ...prev, 
      newUploads: [...(prev.newUploads || []), ...newItems], 
      images: [...prev.images, ...newItems.map(i => i.blobUrl)] 
    }));
  };
  
  const removeParentImage = (/** @type {number} */ index) => {
    setForm(prev => {
      const nImgs = [...prev.images];
      nImgs.splice(index, 1);
      return { ...prev, images: nImgs };
    });
  };

  // --- NEW: Upload Image directly from the Modal ---
  const handleModalFileUpload = (/** @type {any} */ e) => {
    const files = Array.from(e.target.files);
    if (!files.length || imagePickerVariantIndex === null) return;
    const newItems = files.map(f => ({ file: f, blobUrl: URL.createObjectURL(/** @type {File} */ (f)) }));
    
    setForm(prev => {
      const vars = [...prev.variants];
      vars[imagePickerVariantIndex].images = [
        ...(vars[imagePickerVariantIndex].images || []),
        ...newItems.map(i => i.blobUrl)
      ];
      return {
        ...prev,
        newUploads: [...(prev.newUploads || []), ...newItems],
        images: [...prev.images, ...newItems.map(i => i.blobUrl)], // Auto-collects in Master Media
        variants: vars
      };
    });
  };

  const assignImageToVariant = (/** @type {string} */ imageUrl) => {
    if (imagePickerVariantIndex === null) return;
    setForm(prev => {
      const vars = [...prev.variants];
      if (!vars[imagePickerVariantIndex].images.includes(imageUrl)) {
        vars[imagePickerVariantIndex].images = [...(vars[imagePickerVariantIndex].images || []), imageUrl];
      }
      return { ...prev, variants: vars };
    });
  };

  const removeVariantImage = (/** @type {number} */ vIndex, /** @type {number} */ iIndex) => {
    setForm(prev => {
      const vars = [...prev.variants];
      const nImgs = [...(vars[vIndex].images || [])];
      nImgs.splice(iIndex, 1);
      vars[vIndex].images = nImgs;
      return { ...prev, variants: vars };
    });
  };

  const addVariant = () => {
    setForm(prev => ({ ...prev, variants: [...prev.variants, { id: null, name: '', sku: `${prev.code || 'SKU'}-${prev.variants.length + 1}`, attribute_value: '', price: '', discount_price: '', ordering: prev.variants.length, is_active: true, stock_balance: 0, images: [] }] }));
  };

  const updateVariant = (/** @type {number} */ index, /** @type {string} */ field, /** @type {any} */ value) => {
    setForm(prev => { const vars = [...prev.variants]; vars[index] = { ...vars[index], [field]: value }; return { ...prev, variants: vars }; });
  };

  const removeVariant = (/** @type {number} */ index) => {
    setForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const allCategories = ['All Categories', ...new Set(
    products
      .map((/** @type {any} */ p) => p.category)
      .filter(Boolean)
      .map((/** @type {any} */ c) => {
         if (typeof c === 'string') return c.split(',')[0].trim();
         if (Array.isArray(c) && c.length > 0) return String(c[0]).trim();
         return String(c);
      })
  )];

  const filteredProducts = products.filter((/** @type {any} */ p) => {
    if (categoryFilter !== 'All Categories' && !p.category?.includes(categoryFilter)) return false;
    return !searchQuery || `${p.name || ''} ${p.code || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const allCollectedImages = [
    ...form.images.map((url, idx) => ({ url, type: 'parent', index: idx })),
    ...form.variants.flatMap((v, vIdx) => (v.images || []).map((url, iIdx) => ({ url, type: 'variant', vIdx, iIdx })))
  ];
  
  // Deduped collection for the modal picker
  const uniqueModalImageUrls = Array.from(new Set(allCollectedImages.map(img => img.url)));

  return (
    <div className="w-full bg-slate-50/50 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-6rem)] overflow-hidden font-sans">
      
      {/* -------------------- LIST VIEW -------------------- */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
          <div className="p-5 border-b border-slate-200 bg-white flex flex-wrap gap-4 items-center justify-between shrink-0">
            <div className="flex gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search product library..." className="border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm w-full outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-shadow bg-slate-50 hover:bg-white" />
              </div>
              <div className="relative shrink-0 w-48 hidden sm:block">
                 <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-slate-200 rounded-lg pl-9 pr-8 py-2.5 text-sm w-full bg-slate-50 hover:bg-white outline-none focus:border-slate-500 appearance-none cursor-pointer text-slate-700">
                   {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
                 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => refetch()} className="flex items-center justify-center p-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors bg-white hover:text-slate-900" title="Refresh">
                <RefreshCcw size={16} className={isFetching ? "animate-spin" : ""} />
              </button>
              <button onClick={() => { setForm(defaultForm); setView('form'); }} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
                <Plus size={16} /> Create Product
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 custom-scrollbar bg-white">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 w-10"></th>
                  <th className="px-6 py-4">Item Identity</th>
                  <th className="px-6 py-4 text-center">Variants</th>
                  <th className="px-6 py-4 text-right">Base Price</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading catalog...</td></tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  paginatedProducts.map((/** @type {any} */ p) => {
                    const isActive = p.status !== 'inactive';
                    const basePrice = p.product_variants?.[0]?.price || p.price || 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 text-slate-400">
                          <Package size={16} className="opacity-50" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={20} /></div>}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block mb-0.5">{p.name}</span>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{p.code || 'NO-CODE'}</span>
                                {p.category && <span className="uppercase tracking-wider font-sans">{typeof p.category === 'string' ? p.category.split(',')[0] : 'CATEGORY'}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-semibold">
                            {p.product_variants?.length || 0} Options
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-900">
                          ${basePrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                            {isActive ? 'Published' : 'Hidden'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleEditOpen(p)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors" title="Edit Catalog Data"><Edit size={16} /></button>
                            <button onClick={() => setProductToDelete({id: p.id, name: p.name})} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Delete Product"><Trash2 size={16} /></button>
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

      {/* -------------------- FORM VIEW -------------------- */}
      {view === 'form' && (
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 duration-300">
          
          <div className="px-8 py-5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-30 shrink-0 shadow-sm">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button onClick={() => setView('list')} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"><ChevronLeft size={20}/></button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{form.id ? 'Edit Product' : 'Create New Product'}</h1>
                {form.id && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded border border-slate-200">{form.code}</span>}
              </div>
              
              <div className="flex gap-2 mt-4">
                {TOP_TABS.map(tab => (
                  <button key={tab} onClick={() => setActiveTopTab(tab)} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTopTab === tab ? 'bg-slate-900 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3 self-end md:self-auto pb-1 md:pb-0">
              <button onClick={() => setView('list')} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm">
                Discard Changes
              </button>
              <button onClick={() => saveProductMutation.mutate()} disabled={saveProductMutation.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
                {saveProductMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                Save Product
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 flex-1 w-full max-w-[1200px] mx-auto">
            
            {/* GENERAL INFO TAB */}
            {activeTopTab === 'General Info' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                
                {/* Status Bar */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap gap-6 items-center">
                  <div className="flex-1 min-w-[200px]"><ToggleSwitch labelLeft="Storefront Visibility" label={form.status ? 'Published' : 'Hidden'} checked={form.status} onChange={v => setForm({...form, status: v})} /></div>
                  <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                  <div className="flex-1 min-w-[200px]"><ToggleSwitch labelLeft="Best Seller Badge" label={form.is_best_seller ? 'Active' : 'Off'} checked={form.is_best_seller} onChange={v => setForm({...form, is_best_seller: v})} /></div>
                  <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                  <div className="flex-1 min-w-[200px]"><ToggleSwitch labelLeft="Featured Item" label={form.featured ? 'Active' : 'Off'} checked={form.featured} onChange={v => setForm({...form, featured: v})} /></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Core Identity */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Basic Information</h3>
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                          <button type="button" onClick={() => setActiveLangTab('english')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeLangTab === 'english' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>EN</button>
                          <button type="button" onClick={() => setActiveLangTab('khmer')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeLangTab === 'khmer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>KH</button>
                        </div>
                      </div>
                      
                      <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Base SKU / Code *</label>
                            <input type="text" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-mono text-slate-700" placeholder="e.g. PRD-001" required />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Product Type</label>
                            <div className="relative">
                              <select value={form.product_type} onChange={(e) => setForm({...form, product_type: e.target.value})} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white appearance-none text-slate-700">
                                <option value="">Select Type...</option>
                                {dbProductTypes.map((/** @type {any} */ pt) => <option key={pt.id || pt.name} value={pt.title || pt.name}>{pt.title || pt.name}</option>)}
                              </select>
                              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Product Name *</label>
                          <input type="text" value={activeLangTab === 'english' ? form.name : form.name_khmer} onChange={(e) => setForm(activeLangTab === 'english' ? {...form, name: e.target.value} : {...form, name_khmer: e.target.value})} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-900 font-medium" placeholder="Enter product name..." required />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Short Overview</label>
                          <textarea value={activeLangTab === 'english' ? form.overview : form.overview_khmer} onChange={(e) => setForm(activeLangTab === 'english' ? {...form, overview: e.target.value} : {...form, overview_khmer: e.target.value})} rows={3} className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none bg-white text-slate-700" placeholder="Brief summary for catalog cards..." />
                        </div>
                      </div>
                    </div>

                    {/* Master Image Upload Area (Aggregated) */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                       <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">Master Product Media</h3>
                        <p className="text-xs text-slate-500 mt-1">Recommended size: 720 x 960px. Upload generic photos here, or variant-specific photos in the Product Options tab.</p>
                      </div>
                      <div className="p-6">
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors text-center relative flex flex-col items-center justify-center cursor-pointer group">
                          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <UploadCloud size={24} className="text-indigo-500" />
                          </div>
                          <p className="text-sm font-bold text-slate-700">Click or drag images to upload</p>
                          <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP up to 10MB</p>
                          <input type="file" accept="image/*" multiple onChange={handleParentFilesChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        </div>
                        
                        {allCollectedImages.length > 0 && (
                          <div className="flex gap-4 overflow-x-auto py-4 custom-scrollbar mt-2">
                            {allCollectedImages.map((img, idx) => (
                              <div key={idx} className="relative aspect-[3/4] w-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 group shadow-sm">
                                <img src={img.url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                
                                {idx === 0 && <span className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold text-center py-1 rounded">PRIMARY</span>}
                                {img.type === 'variant' && <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-slate-700 border border-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">VAR {img.vIdx + 1}</span>}
                                
                                <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <button type="button" onClick={() => img.type === 'parent' ? removeParentImage(img.index) : removeVariantImage(img.vIdx, img.iIdx)} className="absolute top-2 right-2 bg-white text-rose-600 hover:bg-rose-50 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Taxonomy */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800">Taxonomy</h3></div>
                      <div className="p-6 space-y-6">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Categories</label>
                          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {dbCategories.map((/** @type {any} */ cat) => (
                              <label key={cat.title || cat.name} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                                <input type="checkbox" className="rounded border-slate-300 w-4 h-4 text-indigo-600 focus:ring-indigo-500" checked={form.category_list.includes(cat.title || cat.name)}
                                  onChange={(e) => {
                                    const val = cat.title || cat.name;
                                    setForm({...form, category_list: e.target.checked ? [...form.category_list, val] : form.category_list.filter(c => c !== val)});
                                  }}
                                />
                                <span className="text-sm font-medium text-slate-700">{cat.title || cat.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Search Tags</label><input type="text" value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="tag-1, tag-2..." className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50" /></div>
                        <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Product Set / Collection</label><input type="text" value={form.product_set} onChange={(e) => setForm({...form, product_set: e.target.value})} placeholder="e.g. Summer Collection" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50" /></div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* PRODUCT OPTIONS / VARIANTS TAB */}
            {activeTopTab === 'Product Options' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 max-w-sm">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Variant Label (Storefront)</label>
                    <div className="flex gap-2">
                      <select value={form.variant_label} onChange={(e) => setForm({...form, variant_label: e.target.value})} className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 w-40">
                        <option value="Size">Size</option>
                        <option value="Color">Color</option>
                        <option value="Volume">Volume</option>
                        <option value="Shade">Shade</option>
                        <option value="Scent">Scent</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
                     <p className="text-xs text-slate-500 font-mono hidden md:block max-w-[200px]"><Info size={12} className="inline mr-1"/> Stock levels are managed safely in the Warehouse Ledger.</p>
                     <button type="button" onClick={addVariant} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm shrink-0">
                      <Plus size={16} /> Add Variant Option
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {form.variants.map((variant, index) => {
                    const liveBalance = variant.id && stockBalances[variant.id] ? stockBalances[variant.id].on_hand : 0;
                    
                    return (
                      <div key={index} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
                        
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">{index + 1}</div>
                            <h4 className="font-bold text-slate-800">
                              {variant.attribute_value ? `${form.variant_label}: ${variant.attribute_value}` : 'New Variant Option'}
                            </h4>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                               <input type="checkbox" checked={variant.is_active} onChange={(e) => updateVariant(index, 'is_active', e.target.checked)} className="rounded border-slate-300 w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                               <span className="text-sm font-semibold text-slate-600">Active</span>
                            </label>
                            <div className="w-px h-6 bg-slate-300"></div>
                            <button type="button" onClick={() => removeVariant(index)} disabled={form.variants.length === 1} className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors flex items-center gap-1 text-sm font-medium">
                              <Trash2 size={16} /> <span className="hidden sm:inline">Remove</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-6 flex flex-col xl:flex-row gap-8">
                          
                          {/* Pick From Master Image Strip */}
                          <div className="w-full xl:w-1/3">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Variant Images</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-3 overflow-x-auto custom-scrollbar min-h-[120px]">
                              
                              <div onClick={() => setImagePickerVariantIndex(index)} className="relative shrink-0 w-24 h-32 border-2 border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-400 hover:text-indigo-500 shadow-sm hover:shadow">
                                <ImagePlus size={20} className="mb-1" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-center px-2">Assign<br/>Image</span>
                              </div>

                              {(variant.images || []).map((imgUrl, iIndex) => (
                                <div key={iIndex} className="relative shrink-0 w-24 h-32 rounded-md border border-slate-200 bg-white overflow-hidden group shadow-sm">
                                  <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                  <button type="button" onClick={() => removeVariantImage(index, iIndex)} className="absolute top-1 right-1 bg-white text-rose-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={12}/></button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Variant Name</label>
                              <input type="text" value={variant.name} onChange={(e) => updateVariant(index, 'name', e.target.value)} placeholder="e.g. Midnight Edition" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Variant SKU *</label>
                              <input type="text" value={variant.sku} onChange={(e) => updateVariant(index, 'sku', e.target.value)} placeholder="e.g. PRD-001-S" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50" required />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{form.variant_label} Value *</label>
                              <input type="text" value={variant.attribute_value} onChange={(e) => updateVariant(index, 'attribute_value', e.target.value)} placeholder={`e.g. ${form.variant_label === 'Color' ? 'White' : form.variant_label === 'Size' ? 'Large' : 'Value'}`} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium" required />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Base Price ($) *</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                                <input type="number" step="0.01" value={variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value)} placeholder="0.00" className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-sm font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" required />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Discount Price ($)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                                <input type="number" step="0.01" value={variant.discount_price} onChange={(e) => updateVariant(index, 'discount_price', e.target.value)} placeholder="0.00" className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-sm font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50 text-emerald-600 font-semibold" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Stock Quantity</label>
                              <div className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-50 flex items-center justify-between shadow-inner cursor-not-allowed">
                                 <span className="font-bold text-slate-700">{liveBalance} <span className="text-slate-400 text-xs font-normal ml-1">in stock</span></span>
                                 <Package size={16} className="text-slate-400" />
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EXTENDED CONTENT TABS */}
            {activeTopTab === 'Content Details' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-100 pb-4 gap-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><AlignLeft size={18}/> Rich Content Sections</h3>
                  <div className="flex bg-slate-100 p-1 rounded-lg self-start md:self-auto">
                    <button type="button" onClick={() => setActiveLangTab('english')} className={`px-5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeLangTab === 'english' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>English</button>
                    <button type="button" onClick={() => setActiveLangTab('khmer')} className={`px-5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeLangTab === 'khmer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Khmer</button>
                  </div>
                </div>

                <div className="space-y-8">
                  {[
                    { key: 'description', title: 'Full Description' },
                    { key: 'how_it_works', title: 'How It Works / Usage' },
                    { key: 'key_ingredients', title: 'Key Ingredients' },
                    { key: 'faqs', title: 'Frequently Asked Questions' }
                  ].map(section => (
                    <div key={section.key}>
                       <label className="block text-sm font-bold text-slate-700 mb-2">{section.title} <span className="text-xs text-slate-400 font-normal uppercase ml-2 tracking-wider">({activeLangTab})</span></label>
                       <textarea 
                          value={activeLangTab === 'english' ? form[section.key] : form[`${section.key}_khmer`]}
                          onChange={(e) => setForm({...form, [activeLangTab === 'english' ? section.key : `${section.key}_khmer`]: e.target.value})}
                          rows={4} 
                          placeholder={`Enter ${section.title.toLowerCase()} content here...`} 
                          className="w-full border border-slate-200 rounded-lg p-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 resize-y" 
                        />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MASTER MEDIA IMAGE PICKER MODAL (WITH UPLOAD OPTION) */}
      {imagePickerVariantIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><ImagePlus size={18} className="text-indigo-600"/> Assign Image to Variant</h3>
              <button onClick={() => setImagePickerVariantIndex(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                
                {/* DYNAMIC UPLOAD CARD */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 hover:border-indigo-400 transition-all cursor-pointer text-slate-400 hover:text-indigo-600 shadow-sm">
                  <UploadCloud size={24} className="mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-center">Upload<br/>New</span>
                  <input type="file" accept="image/*" multiple onChange={handleModalFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                </div>

                {uniqueModalImageUrls.map((imgUrl, idx) => {
                  const isSelected = form.variants[imagePickerVariantIndex].images.includes(imgUrl);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => assignImageToVariant(imgUrl)}
                      className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-600 ring-offset-2 opacity-50 cursor-not-allowed' : 'border-transparent hover:border-indigo-300 shadow-sm hover:shadow'}`}
                    >
                      <img src={imgUrl} alt={`Master ${idx}`} className="w-full h-full object-cover" />
                      {isSelected && <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center"><CheckCircle2 className="text-white" size={24} /></div>}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setImagePickerVariantIndex(null)} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-rose-500" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Product?</h2>
              <p className="text-sm text-slate-500 mb-8">Are you sure you want to delete "<span className="font-semibold text-slate-800">{productToDelete.name}</span>"? This will also archive all associated variants.</p>
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