// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Save, X } from 'lucide-react';

export default function CreateRole() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [form, setForm] = useState({ name: '', description: '', is_active: true });
  const [selectedPerms, setSelectedPerms] = useState([]);

  // Fetch all available permissions to build the checklist
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('admin_permissions').select('*').order('resource');
      return data || [];
    }
  });

  // If editing, fetch the existing role data
  useEffect(() => {
    if (isEditing) {
      const fetchRole = async () => {
        const { data: role } = await supabase.from('admin_roles').select('*').eq('id', id).single();
        if (role) setForm({ name: role.name, description: role.description || '', is_active: role.is_active });
        
        const { data: perms } = await supabase.from('admin_role_permissions').select('permission_id').eq('role_id', id);
        if (perms) setSelectedPerms(perms.map(p => p.permission_id));
      };
      fetchRole();
    }
  }, [id, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let roleId = id;
      
      // 1. Insert or Update Role Table
      if (isEditing) {
        const { error } = await supabase.from('admin_roles').update(form).eq('id', roleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('admin_roles').insert([form]).select().single();
        if (error) throw error;
        roleId = data.id;
      }

      // 2. Sync Permissions (Delete old, insert new)
      await supabase.from('admin_role_permissions').delete().eq('role_id', roleId);
      
      if (selectedPerms.length > 0) {
        const mappingRows = selectedPerms.map(permId => ({ role_id: roleId, permission_id: permId }));
        const { error: mapError } = await supabase.from('admin_role_permissions').insert(mappingRows);
        if (mapError) throw mapError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      navigate('/admin/roles');
    },
    onError: (err) => alert('Failed to save role: ' + err.message)
  });

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {});

  const handleToggle = (permId) => {
    setSelectedPerms(prev => prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]);
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
        <h1 className="text-3xl font-bold font-display uppercase tracking-tight text-slate-900">
          {isEditing ? 'Edit Role' : 'Create Role'}
        </h1>
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin/roles')} className="bg-red-50 text-red-600 px-5 py-2.5 rounded-md flex items-center gap-2 hover:bg-red-100 transition-colors text-sm font-bold">
            <X size={16} strokeWidth={3} /> Discard
          </button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name} className="bg-slate-800 text-white px-5 py-2.5 rounded-md flex items-center gap-2 hover:bg-slate-700 transition-colors text-sm font-bold disabled:opacity-50">
            <Save size={16} /> Save Role
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left Col: Role Details */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Role Information</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} className="w-full border border-slate-300 rounded-md px-4 py-2.5 outline-none focus:border-slate-500 bg-slate-50" placeholder="e.g. MANAGER" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} rows={4} className="w-full border border-slate-300 rounded-md px-4 py-2.5 outline-none focus:border-slate-500 bg-slate-50 resize-none" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button 
                onClick={() => setForm(f => ({...f, is_active: !f.is_active}))}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-slate-800' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-200 ${form.is_active ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
              <span className="font-semibold text-slate-700">Active</span>
            </div>
          </div>
        </div>

        {/* Right Col: Permissions List */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm max-h-[70vh] overflow-y-auto custom-scrollbar">
          <h2 className="text-xl font-bold text-slate-800 mb-6 sticky top-0 bg-white z-10 pb-2">Permissions</h2>
          
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([resource, perms]) => (
              <div key={resource}>
                <h3 className="font-bold text-slate-800 capitalize mb-3 text-lg border-b border-slate-100 pb-1">{resource}</h3>
                <div className="space-y-2">
                  {perms.map(perm => (
                    <label key={perm.id} className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-1.5 rounded -ml-1.5">
                      <div className="relative flex items-center">
                        <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => handleToggle(perm.id)} className="peer sr-only" />
                        <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-slate-800 peer-checked:border-slate-800 transition-colors flex items-center justify-center">
                          {selectedPerms.includes(perm.id) && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{perm.action}</span>
                      <span className="text-xs text-slate-400">— {perm.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}