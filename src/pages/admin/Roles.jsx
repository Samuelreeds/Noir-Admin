// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Shield, Edit, Trash2, Plus } from 'lucide-react';

export default function Roles() {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      // Fetch roles with a count of attached permissions
      const { data, error } = await supabase
        .from('admin_roles')
        .select(`*, admin_role_permissions(count)`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('admin_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
    onError: (err) => alert('Failed to delete role: ' + err.message)
  });

  if (isLoading) return <div className="p-8 text-slate-500">Loading roles...</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-display uppercase tracking-tight text-slate-900">Role Management</h1>
        <Link to="/admin/roles/create" className="bg-slate-900 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-slate-800 transition-colors text-sm font-medium">
          <Plus size={16} /> Create Role
        </Link>
      </div>

      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 shrink-0">
              <Shield className="text-slate-500" size={24} strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 uppercase">{role.name}</h2>
              <p className="text-sm text-slate-500 truncate mt-0.5">{role.description || "No description provided."}</p>
              
              <div className="flex items-center gap-3 mt-2.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${role.is_active ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {role.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs font-medium text-slate-500">{role.admin_role_permissions?.[0]?.count || 0} permissions</span>
                <span className="text-xs font-medium text-slate-500">0 users</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Link to={`/admin/roles/${role.id}`} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors">
                <Edit size={18} />
              </Link>
              {role.name !== 'SUPER_ADMIN' && (
                <button 
                  onClick={() => { if(window.confirm('Delete this role?')) deleteMutation.mutate(role.id) }} 
                  className="p-2 bg-slate-100 text-red-600 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        {roles.length === 0 && <p className="text-slate-500">No roles configured.</p>}
      </div>
    </div>
  );
}