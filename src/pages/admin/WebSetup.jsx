import React, { useState } from 'react';
import { Save, Image as ImageIcon, Layout, Info, Phone, RefreshCcw, CheckCircle, Filter, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- IMAGE COMPRESSION UTILITY ---
const processImageToWebP = (/** @type {File} */ file) => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error("File too large (Max 10MB)."));
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = /** @type {string} */ (event.target?.result);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920; 
        const MAX_HEIGHT = 1080;
        let { width, height } = img;

        if (width > height && width > MAX_WIDTH) {
          height *= MAX_WIDTH / width; width = MAX_WIDTH;
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height; height = MAX_HEIGHT;
        }

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

const uploadAssetToSupabase = async (/** @type {File} */ file, /** @type {string} */ prefix) => {
  const processedFile = await processImageToWebP(file);
  const fileName = `${prefix}_${Date.now()}.webp`;
  const { error: uploadError } = await supabase.storage.from('site-assets').upload(fileName, processedFile);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('site-assets').getPublicUrl(fileName);
  return data.publicUrl;
};

export default function WebSetup() {
  const [activeTab, setActiveTab] = useState('hero');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const queryClient = useQueryClient();

  const defaultForm = {
    hero_heading: '', hero_subheading: '', hero_button_text: '', hero_button_link: '', 
    hero_image: '', hero_image_file: null, hero_image_preview: '',
    about_heading: '', about_text: '', about_image: '', about_image_file: null, about_image_preview: '',
    contact_email: '', contact_phone: '', social_instagram: '',
    store_genders: 'Men, Women, Unisex',
    shipping_pp_price: '1.50',
    shipping_province_price: '2.50',
    enable_tax: false,
    tax_rate: '8.00'
  };

  const [form, setForm] = useState(defaultForm);

  const { isLoading } = useQuery({
    queryKey: ['admin-web-setup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (error && error.code !== 'PGRST116') throw error; 
      
      if (data) {
        setForm(prev => ({
          ...prev, ...data,
          hero_image_preview: data.hero_image || '',
          about_image_preview: data.about_image || '',
          store_genders: data.genders ? data.genders.join(', ') : 'Men, Women, Unisex',
          shipping_pp_price: data.shipping_pp_price?.toString() ?? '1.50',
          shipping_province_price: data.shipping_province_price?.toString() ?? '2.50',
          enable_tax: !!data.enable_tax,
          tax_rate: data.tax_rate?.toString() ?? '8.00'
        }));
      }
      return data || {};
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      let heroUrl = form.hero_image;
      let aboutUrl = form.about_image;

      if (form.hero_image_file) heroUrl = await uploadAssetToSupabase(form.hero_image_file, 'hero');
      if (form.about_image_file) aboutUrl = await uploadAssetToSupabase(form.about_image_file, 'about');

      const payload = {
        id: 1,
        hero_heading: form.hero_heading,
        hero_subheading: form.hero_subheading,
        hero_button_text: form.hero_button_text,
        hero_button_link: form.hero_button_link,
        hero_image: heroUrl,
        about_heading: form.about_heading,
        about_text: form.about_text,
        about_image: aboutUrl,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        social_instagram: form.social_instagram,
        genders: form.store_genders.split(',').map(s => s.trim()).filter(Boolean),
        shipping_pp_price: parseFloat(form.shipping_pp_price || '0'),
        shipping_province_price: parseFloat(form.shipping_province_price || '0'),
        enable_tax: form.enable_tax,
        tax_rate: parseFloat(form.tax_rate || '0')
      };

      const { error } = await supabase.from('store_settings').upsert(payload);
      if (error) throw error;
      return payload;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-web-setup'] });
      setForm(prev => ({ ...prev, hero_image_file: null, about_image_file: null, hero_image: data.hero_image, about_image: data.about_image }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err) => alert(err.message)
  });

  const handleFileChange = (/** @type {any} */ e, /** @type {string} */ type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (type === 'hero') {
      setForm(prev => ({ ...prev, hero_image_file: file, hero_image_preview: previewUrl }));
    } else {
      setForm(prev => ({ ...prev, about_image_file: file, about_image_preview: previewUrl }));
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><RefreshCcw className="animate-spin text-slate-400" /></div>;

  return (
    <div className="max-w-[1200px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-1">Web Setup</h1>
          <p className="text-sm text-slate-500">Manage storefront banner, content, shipping fees, and tax settings.</p>
        </div>
        <button 
          onClick={() => saveSettingsMutation.mutate()} 
          disabled={saveSettingsMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-md text-sm font-medium transition-all disabled:opacity-50 shadow-sm cursor-pointer"
        >
          {saveSettingsMutation.isPending ? <RefreshCcw size={16} className="animate-spin" /> : saveSuccess ? <CheckCircle size={16} className="text-emerald-400" /> : <Save size={16} />}
          {saveSettingsMutation.isPending ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-1">
          <button onClick={() => setActiveTab('hero')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'hero' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Layout size={18} /> Hero Section</button>
          <button onClick={() => setActiveTab('about')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'about' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Info size={18} /> About Section</button>
          <button onClick={() => setActiveTab('contact')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'contact' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Phone size={18} /> Footer & Contact</button>
          <button onClick={() => setActiveTab('filters')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'filters' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Filter size={18} /> Store Filters</button>
          <button onClick={() => setActiveTab('shipping')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shipping' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Truck size={18} /> Shipping & Tax</button>
        </div>

        {/* Form Content */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-6 md:p-8">
          
          {/* HERO TAB */}
          {activeTab === 'hero' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-3">Homepage Hero Banner</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Hero Background Image</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center hover:bg-slate-100 transition-colors relative">
                  {form.hero_image_preview ? (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden mb-3"><img src={form.hero_image_preview} alt="Hero Preview" className="w-full h-full object-cover" /></div>
                  ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center text-slate-400 mb-3"><ImageIcon size={32} className="mb-2" /><p className="text-sm">No image uploaded</p></div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'hero')} className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Hero Heading</label><input type="text" value={form.hero_heading} onChange={e => setForm({...form, hero_heading: e.target.value})} placeholder="e.g. Redefining Basics" className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Hero Subheading</label><textarea value={form.hero_subheading} onChange={e => setForm({...form, hero_subheading: e.target.value})} placeholder="e.g. Explore our new minimalist collection." rows={2} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500 resize-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Button Text</label><input type="text" value={form.hero_button_text} onChange={e => setForm({...form, hero_button_text: e.target.value})} placeholder="e.g. Shop Collection" className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Button Target URL</label><input type="text" value={form.hero_button_link} onChange={e => setForm({...form, hero_button_link: e.target.value})} placeholder="e.g. /shop" className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500 font-mono" /></div>
              </div>
            </div>
          )}

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-3">About Us Section</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">About Image (Side/Featured)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center hover:bg-slate-100 transition-colors">
                  {form.about_image_preview ? (
                    <div className="relative w-full max-w-sm mx-auto h-48 rounded-lg overflow-hidden mb-3"><img src={form.about_image_preview} alt="About Preview" className="w-full h-full object-cover" /></div>
                  ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center text-slate-400 mb-3"><ImageIcon size={32} className="mb-2" /><p className="text-sm">No image uploaded</p></div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'about')} className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer" />
                </div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">About Heading</label><input type="text" value={form.about_heading} onChange={e => setForm({...form, about_heading: e.target.value})} placeholder="e.g. Our Story" className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">About Text Paragraph</label><textarea value={form.about_text} onChange={e => setForm({...form, about_text: e.target.value})} placeholder="Write about your brand..." rows={5} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500 resize-none" /></div>
            </div>
          )}

          {/* CONTACT TAB */}
          {activeTab === 'contact' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-3">Footer & Contact Details</h2>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Support Email</label><input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} placeholder="hello@bare.com" className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Support Phone</label><input type="text" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} placeholder="+1 (555) 000-0000" className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500 font-mono" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Instagram URL</label><input type="url" value={form.social_instagram} onChange={e => setForm({...form, social_instagram: e.target.value})} placeholder="https://instagram.com/..." className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500 font-mono" /></div>
            </div>
          )}

          {/* STORE FILTERS TAB */}
          {activeTab === 'filters' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-3">Store Taxonomies & Filters</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Available Genders</label>
                <input 
                  type="text" 
                  value={form.store_genders} 
                  onChange={e => setForm({...form, store_genders: e.target.value})} 
                  placeholder="e.g. Men, Women, Unisex, Kids" 
                  className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm outline-none focus:border-slate-500" 
                />
                <p className="text-[10px] text-slate-500 mt-1.5">Separate multiple genders with a comma.</p>
              </div>
            </div>
          )}

          {/* --- NEW: SHIPPING & TAX TAB --- */}
          {activeTab === 'shipping' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-3">Delivery Rates & Tax Settings</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Phnom Penh Delivery Fee ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.shipping_pp_price} 
                    onChange={e => setForm({...form, shipping_pp_price: e.target.value})} 
                    placeholder="1.50" 
                    className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm font-mono outline-none focus:border-slate-500" 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Shipping price applied for Phnom Penh addresses.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Provinces Delivery Fee ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.shipping_province_price} 
                    onChange={e => setForm({...form, shipping_province_price: e.target.value})} 
                    placeholder="2.50" 
                    className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm font-mono outline-none focus:border-slate-500" 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Shipping price applied for other Cambodian provinces.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Enable Tax on Checkout</h3>
                    <p className="text-xs text-slate-500 mt-0.5">When disabled, Tax line item is completely hidden from the order summary.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.enable_tax} 
                      onChange={e => setForm({...form, enable_tax: e.target.checked})} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                  </label>
                </div>

                {form.enable_tax && (
                  <div className="animate-in fade-in duration-200 pt-2">
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tax Rate Percentage (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={form.tax_rate} 
                      onChange={e => setForm({...form, tax_rate: e.target.value})} 
                      placeholder="8.00" 
                      className="w-full max-w-xs border border-slate-300 rounded px-3 py-2.5 text-sm font-mono outline-none focus:border-slate-500" 
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Calculated as a percentage of the order subtotal.</p>
                  </div>
                )}
              </div>

            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}