
import React, { useState } from 'react';
import { StockLog } from '../types';
import { ClipboardList, ArrowDownCircle, PlusCircle, Trash2, UserPlus, ArrowLeftCircle, Filter, Clock, Calendar } from 'lucide-react';

interface LogsProps {
  logs: StockLog[];
}

const Logs: React.FC<LogsProps> = ({ logs }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredLogs = (logs || []).filter(log => {
      if (!log) return false;
      if (filterType === 'ALL') return true;
      if (filterType === 'INBOUND') return log.action === 'INBOUND' || log.action === 'CREATE';
      return log.action === filterType;
  });

  const getDisplayName = (email: string | undefined) => {
    if (!email || typeof email !== 'string') return 'System';
    return email.split('@')[0] || email;
  };

  const getActionBadge = (action: string, minimal = false) => {
      const styles = {
        INBOUND: "text-emerald-700 bg-emerald-50 border-emerald-100",
        CREATE: "text-blue-700 bg-blue-50 border-blue-100",
        ASSIGN: "text-indigo-700 bg-indigo-50 border-indigo-100",
        RETURN: "text-amber-700 bg-amber-50 border-amber-100",
        SCRAP: "text-red-700 bg-red-50 border-red-100",
        UPDATE: "text-slate-700 bg-slate-50 border-slate-100"
      };

      const icons = {
        INBOUND: <ArrowDownCircle size={minimal ? 12 : 14}/>,
        CREATE: <PlusCircle size={minimal ? 12 : 14}/>,
        ASSIGN: <UserPlus size={minimal ? 12 : 14}/>,
        RETURN: <ArrowLeftCircle size={minimal ? 12 : 14}/>,
        SCRAP: <Trash2 size={minimal ? 12 : 14}/>,
        UPDATE: <Clock size={minimal ? 12 : 14}/>
      };

      const normalizedAction = (action || 'UPDATE').toUpperCase();
      const label = normalizedAction === 'INBOUND' ? 'INBOUND' : 
                    normalizedAction === 'CREATE' ? 'CREATE' : 
                    normalizedAction === 'ASSIGN' ? 'ASSIGN' : 
                    normalizedAction === 'RETURN' ? 'RETURN' : 
                    normalizedAction === 'SCRAP' ? 'SCRAP' : 'UPDATE';

      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm ${styles[normalizedAction as keyof typeof styles] || styles.UPDATE}`}>
           {icons[normalizedAction as keyof typeof icons] || icons.UPDATE} {label}
        </span>
      );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <ClipboardList className="text-blue-600" size={24} />
                History
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Audit trail of all regional stock movements.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <Filter size={14} className="text-slate-400" />
             <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-black uppercase tracking-widest rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer shadow-sm min-w-[160px]"
             >
                 <option value="ALL">All Actions</option>
                 <option value="INBOUND">Inbound / Create</option>
                 <option value="ASSIGN">Assigned</option>
                 <option value="RETURN">Returned</option>
                 <option value="SCRAP">Scrapped</option>
             </select>
          </div>
        </div>
        
        {/* Mobile View: Timeline Cards */}
        <div className="md:hidden divide-y divide-slate-50">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-6 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                 <div className="flex justify-between items-start">
                    {getActionBadge(log.action)}
                    <div className="text-right">
                       <p className={`text-lg font-mono font-black ${log.action === 'SCRAP' || log.action === 'ASSIGN' ? 'text-red-500' : 'text-emerald-500'}`}>
                         {log.action === 'SCRAP' || log.action === 'ASSIGN' ? '-' : '+'}{log.quantity || 0}
                       </p>
                    </div>
                 </div>
                 <div>
                    <h4 className="font-black text-slate-900 leading-tight">{log.productName || 'Unknown Product'}</h4>
                    {log.details && <p className="text-xs text-slate-500 mt-1 italic leading-relaxed">"{log.details}"</p>}
                 </div>
                 <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400">
                       <Clock size={12} /> {log.date ? new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </div>
                    <div className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                       By: {getDisplayName(log.performedBy)}
                    </div>
                 </div>
              </div>
            ))
          ) : (
            <div className="p-20 text-center text-slate-300">
               <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
               <p className="font-black uppercase text-[10px] tracking-widest">No activity found</p>
            </div>
          )}
        </div>

        {/* Desktop View: Wide Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-5">Action Type</th>
                <th className="px-6 py-5">Asset Involved</th>
                <th className="px-6 py-5 text-center">Qty ∆</th>
                <th className="px-6 py-5">System Agent</th>
                <th className="px-6 py-5">Timestamp</th>
                <th className="px-8 py-5">Extended Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-black text-slate-900">{log.productName || 'Deleted Asset'}</div>
                    </td>
                    <td className="px-6 py-5 text-center font-mono font-black text-sm">
                      <span className={log.action === 'SCRAP' || log.action === 'ASSIGN' ? 'text-red-500' : 'text-emerald-500'}>
                        {log.action === 'SCRAP' || log.action === 'ASSIGN' ? '-' : '+'}{log.quantity || 0}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                             {getDisplayName(log.performedBy).substring(0,1).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-600 font-medium">{log.performedBy || 'System'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-slate-400 text-[10px] font-bold">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Calendar size={12} />
                        {log.date ? new Date(log.date).toLocaleDateString() : 'N/A'}
                        <Clock size={12} className="ml-1 opacity-50" />
                        {log.date ? new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs text-slate-500 italic max-w-xs truncate">
                        {log.details || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <ClipboardList size={64} className="mx-auto mb-4 text-slate-100" strokeWidth={1} />
                    <p className="font-black uppercase text-[10px] tracking-widest text-slate-300">Audit logs are currently clear</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Logs;
