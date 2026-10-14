// @ts-nocheck
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, XCircle, CheckCircle, Clock, ShieldAlert, Bug, Activity, AlertOctagon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ACTIONS = ["All actions", "Create", "Update", "Delete", "Register", "Purchase", "Login"];
const RESOURCES = ["All resources", "Product", "User", "Order", "Collection", "Coupon", "Promotion", "Role"];

export default function ActivityLogs() {
  // View Toggle State
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'errors'

  // --- ACTIVITY LOG STATES ---
  const [actionFilter, setActionFilter] = useState("All actions");
  const [resourceFilter, setResourceFilter] = useState("All resources");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- SYSTEM ERROR STATES ---
  const [errorStatusFilter, setErrorStatusFilter] = useState("unresolved");

  // Fetch Activity Logs Data (Existing)
  const { data: logs = [], isLoading: isActivityLoading } = useQuery({
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
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === 'activity',
    refetchInterval: 30000 
  });

  // Fetch System Error Logs Data (New)
  const { data: errorLogs = [], isLoading: isErrorLoading, refetch: refetchErrors } = useQuery({
    queryKey: ['system-error-logs', errorStatusFilter],
    queryFn: async () => {
      let query = supabase
        .from('system_error_logs')
        .select('*')
        .order('last_seen_at', { ascending: false })
        .limit(100);

      if (errorStatusFilter !== 'all') {
        query = query.eq('status', errorStatusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === 'errors',
    refetchInterval: 30000
  });

  // Apply Activity Filters
  const filteredLogs = logs.filter(log => {
    if (actionFilter !== "All actions" && log.action?.toUpperCase() !== actionFilter.toUpperCase()) return false;
    if (resourceFilter !== "All resources" && log.resource?.toUpperCase() !== resourceFilter.toUpperCase()) return false;
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

  // Helper: Format Error Severity
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <ShieldAlert size={16} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
      default: return <Bug size={16} className="text-blue-500" />;
    }
  };

  // Action: Toggle Error Status
  const toggleErrorStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'resolved' ? 'unresolved' : 'resolved';
    try {
      const { error } = await supabase
        .from('system_error_logs')
        .update({ status: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      refetchErrors();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Could not update error status. Check permissions.');
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Page Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display uppercase tracking-tight text-slate-900">
            {activeTab === 'activity' ? 'ACTIVITY LOG' : 'SYSTEM ERRORS'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'activity' 
              ? 'Track important system actions and user activities' 
              : 'Monitor production crashes, failed checkouts, and network errors'}
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'activity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity size={16} /> User Actions
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'errors' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertOctagon size={16} /> System Errors
          </button>
        </div>
      </div>

      {/* --- TAB: ACTIVITY LOGS --- */}
      {activeTab === 'activity' && (
        <>
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
                  {isActivityLoading ? (
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
                          <td className="px-6 py-4 text-slate-600 text-xs">{timestamp}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{log.profiles?.full_name || 'System / Guest'}</div>
                            <div className="text-xs text-slate-500">{log.profiles?.email || ''}</div>
                          </td>
                          <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{log.resource}</td>
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
        </>
      )}

      {/* --- TAB: SYSTEM ERRORS --- */}
      {activeTab === 'errors' && (
        <>
          {/* Error Filters Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Error Status</h2>
            <div className="flex gap-2">
              {['unresolved', 'resolved', 'all'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setErrorStatusFilter(tab)}
                  className={`px-5 py-2 font-mono text-xs uppercase rounded transition-colors ${
                    errorStatusFilter === tab 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Error Logs Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
            <div className="px-6 py-4 border-b border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-800 capitalize">{errorStatusFilter} Errors</h2>
            </div>
            
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Severity</th>
                    <th className="px-6 py-4">Error Details</th>
                    <th className="px-6 py-4">Route</th>
                    <th className="px-6 py-4">Count</th>
                    <th className="px-6 py-4">Last Seen</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isErrorLoading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading system errors...</td></tr>
                  ) : errorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <CheckCircle size={32} className="mx-auto mb-4 text-emerald-500 opacity-50" />
                        No {errorStatusFilter !== 'all' ? errorStatusFilter : ''} system errors found.
                      </td>
                    </tr>
                  ) : (
                    errorLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(log.severity)}
                            <span className={`uppercase text-[10px] font-bold tracking-wider ${
                              log.severity === 'critical' ? 'text-red-600' : 
                              log.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                            }`}>
                              {log.severity}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-sm">
                          <p className="font-semibold text-slate-900 truncate">{log.error_name}</p>
                          <p className="text-slate-500 text-xs truncate mt-0.5" title={log.message}>
                            {log.message}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-mono border border-slate-200">
                            {log.route}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-900 text-white px-2 py-0.5 text-[10px] font-bold rounded-full">
                            {log.occurrence_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 flex items-center gap-1.5 mt-2">
                          <Clock size={14} className="text-slate-400" />
                          {formatDistanceToNow(new Date(log.last_seen_at), { addSuffix: true })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => toggleErrorStatus(log.id, log.status)}
                            className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ml-auto font-semibold ${
                              log.status === 'resolved' 
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {log.status === 'resolved' ? (
                              <><XCircle size={14} /> Reopen</>
                            ) : (
                              <><CheckCircle size={14} /> Resolve</>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}