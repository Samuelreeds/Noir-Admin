// @ts-nocheck
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export default function Permissions() {
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_permissions').select('*').order('resource');
      if (error) throw error;
      return data || [];
    }
  });

  // Group permissions by resource category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {});

  if (isLoading) return <div className="p-8 text-slate-500">Loading permissions...</div>;

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-3xl font-bold font-display uppercase tracking-tight text-slate-900">Permissions</h1>
      
      {Object.entries(groupedPermissions).map(([resource, perms]) => (
        <div key={resource} className="bg-slate-50 border border-slate-200 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-6 capitalize text-slate-800">{resource}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {perms.map((perm) => (
              <div key={perm.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-slate-900 capitalize">{perm.action} {resource}</h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                    {resource}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mb-1">{perm.action}</p>
                <p className="text-xs text-slate-400 mt-auto">{perm.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}