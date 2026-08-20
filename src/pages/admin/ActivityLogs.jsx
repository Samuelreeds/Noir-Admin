// @ts-nocheck
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const ACTIONS = ["All actions", "Create", "Update", "Delete", "Register", "Purchase", "Login"];
const RESOURCES = ["All resources", "Product", "User", "Order", "Collection", "Coupon", "Promotion", "Role"];

export default function ActivityLogs() {
  // Filter States
  const [actionFilter, setActionFilter] = useState("All actions");
  const [resourceFilter, setResourceFilter] = useState("All resources");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch Logs Data
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id, 
          created_at, 
          action, 
          resource, 
          details,
          profiles (full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(500); // Fetch top 500 for performance

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000 // Automatically refresh every 30 seconds
  });

  // Apply Filters
  const filteredLogs = logs.filter(log => {
    // Action Filter
    if (actionFilter !== "All actions" && log.action?.toUpperCase() !== actionFilter.toUpperCase()) return false;
    
    // Resource Filter
    if (resourceFilter !== "All resources" && log.resource?.toUpperCase() !== resourceFilter.toUpperCase()) return false;
    
    // Date Filters
    if (startDate && new Date(log.created_at) < new Date(startDate)) return false;
    if (endDate) {
      const toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999);
      if (new Date(log.created_at) > toDate) return false;
    }
    
    return true;
  });

  // Helper: Format action badges
  const getActionBadge = (action) => {
    const act = action?.toUpperCase() || '';
    switch (act) {
      case 'REGISTER': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">{act}</span>;
      case 'LOGIN': return <span className="text-slate-700 text-xs font-bold tracking-wider">{act}</span>;
      case 'CREATE': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">{act}</span>;
      case 'DELETE': return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">{act}</span>;
      case 'UPDATE': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">{act}</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">{act}</span>;
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display uppercase tracking-tight text-slate-900">ACTIVITY LOG</h1>
        <p className="text-slate-500 text-sm mt-1">Track important system actions and user activities</p>
      </div>

      {/* Filters Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Action</label>
            <select 
              value={actionFilter} 
              onChange={(e) => setActionFilter(e.target.value)} 
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer text-slate-700"
            >
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Resource</label>
            <select 
              value={resourceFilter} 
              onChange={(e) => setResourceFilter(e.target.value)} 
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none cursor-pointer text-slate-700"
            >
              {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white outline-none text-slate-700"
            />
          </div>

        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
        <div className="px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800">Activity Logs</h2>
        </div>
        
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No activities found matching the filters.</td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const timestamp = new Date(log.created_at).toLocaleString('en-US', {
                    month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {timestamp}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{log.profiles?.full_name || 'System / Guest'}</div>
                        <div className="text-xs text-slate-500">{log.profiles?.email || ''}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        {log.resource}
                      </td>
                      <td className="px-6 py-4">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <div className="flex flex-col gap-0.5 text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100 w-fit">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-semibold text-slate-800">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No details</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}