import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, AlertTriangle, BrainCircuit, UserCog, ShieldCheck, Check, X, Lock, Database, MapPin, Building2, Globe } from 'lucide-react';
import AIAdvisor from './AIAdvisor';
import { Product, Assignment, ScrappedItem, Employee, AppUser, Warehouse } from '../types';
import { supabase } from '../services/supabaseClient';
import { fetchAllUsers, updateUserStatus, fetchWarehouses, createWarehouseApi, updateUserWarehouses } from '../services/storageService';

interface SettingsProps {
  categories: string[];
  products: Product[];
  assignments: Assignment[];
  scrappedItems: ScrappedItem[];
  employees: Employee[];
  onAddCategory: (category: string) => void;
  onDeleteCategory: (category: string) => void;
  onImportData: (data: any) => void;
  currentUser: AppUser | null;
  activeWarehouseId: string;
}

const Settings: React.FC<SettingsProps> = ({ 
  categories, products, assignments, scrappedItems, employees,
  onAddCategory, onDeleteCategory, onImportData, currentUser, activeWarehouseId
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'advisor' | 'account' | 'users' | 'warehouses'>('general');
  const [newCategory, setNewCategory] = useState('');
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [newWhName, setNewWhName] = useState('');
  const [newWhLoc, setNewWhLoc] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [showSchema, setShowSchema] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    if ((activeTab === 'users' || activeTab === 'warehouses') && isSuperAdmin) {
      loadAdminData();
    }
  }, [activeTab, isSuperAdmin]);

  const loadAdminData = async () => {
    try {
      const [users, whs] = await Promise.all([fetchAllUsers(), fetchWarehouses()]);
      setAllUsers(users);
      setWarehouses(whs);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName) return;
    try {
      await createWarehouseApi(newWhName, newWhLoc);
      setNewWhName('');
      setNewWhLoc('');
      const whs = await fetchWarehouses();
      setWarehouses(whs);
    } catch (error) {
      alert("Failed to create warehouse");
    }
  };

  const toggleWarehouseForUser = async (userEmail: string, warehouseId: string) => {
    const user = allUsers.find(u => u.email === userEmail);
    if (!user || user.role === 'super_admin') return; // Super Admins have inherent access to all

    let updatedList = [...user.assigned_warehouses];
    if (updatedList.includes(warehouseId)) {
      updatedList = updatedList.filter(id => id !== warehouseId);
    } else {
      updatedList.push(warehouseId);
    }

    try {
      await updateUserWarehouses(userEmail, updatedList);
      setAllUsers(allUsers.map(u => u.email === userEmail ? { ...u, assigned_warehouses: updatedList } : u));
    } catch (error) {
      alert("Failed to update user permissions");
    }
  };

  const toggleUserStatus = async (email: string, currentStatus: boolean) => {
    try {
      await updateUserStatus(email, !currentStatus);
      setAllUsers(allUsers.map(u => u.email === email ? { ...u, is_approved: !currentStatus } : u));
    } catch (error) {
      alert("Failed to update user status");
    }
  };
  
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; category: string; type: 'CONFIRM' | 'BLOCKED'; count?: number }>({ isOpen: false, category: '', type: 'CONFIRM' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategory.trim()) {
      onAddCategory(newCategory.trim());
      setNewCategory('');
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: 'Passwords do not match' }); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: 'success', text: 'Password updated' });
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { setPasswordMsg({ type: 'error', text: err.message }); }
  };

  const sqlSchema = `-- MULTI-WAREHOUSE REPAIR SCRIPT
create table if not exists warehouses (id uuid primary key default gen_random_uuid(), name text not null, location text, created_at timestamptz default now());

-- Update tables with warehouse_id
alter table products add column if not exists warehouse_id uuid references warehouses(id);
alter table employees add column if not exists warehouse_id uuid references warehouses(id);
alter table assignments add column if not exists warehouse_id uuid references warehouses(id);
alter table scrapped_items add column if not exists warehouse_id uuid references warehouses(id);
alter table stock_logs add column if not exists warehouse_id uuid references warehouses(id);
alter table categories add column if not exists warehouse_id uuid references warehouses(id);
alter table app_users add column if not exists assigned_warehouses uuid[] default '{}';

-- Final Cache Reload
NOTIFY pgrst, 'reload config';
`;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
       <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit mb-6 overflow-x-auto">
        <button onClick={() => setActiveTab('general')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'general' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Tag size={16} /> General
        </button>
        <button onClick={() => setActiveTab('account')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'account' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <UserCog size={16} /> My Account
        </button>
        <button onClick={() => setActiveTab('advisor')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'advisor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BrainCircuit size={16} /> AI Advisor
        </button>
        {isSuperAdmin && (
          <>
            <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ShieldCheck size={16} /> User Management
            </button>
            <button onClick={() => setActiveTab('warehouses')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'warehouses' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Building2 size={16} /> Warehouses
            </button>
          </>
        )}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6 animate-slide-up">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Tag className="text-blue-600" size={20} /> Category Management
                  </h3>
                  <button onClick={() => setShowSchema(true)} className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 shadow-sm">
                    <Database size={14} /> Multi-Warehouse SQL Repair
                  </button>
                </div>
                <form onSubmit={handleAdd} className="flex gap-3 mb-8">
                  <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category for active warehouse..." className="flex-1 px-4 py-2 border rounded-lg outline-none" />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} /> Add Category
                  </button>
                </form>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg group hover:border-blue-200">
                      <span className="font-medium text-slate-700">{category}</span>
                      <button onClick={() => onDeleteCategory(category)} className="text-slate-400 hover:text-red-500 p-1.5 rounded"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'warehouses' && isSuperAdmin && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Building2 className="text-amber-600" size={20} /> Manage Warehouses
            </h3>
            <form onSubmit={handleCreateWarehouse} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse Name</label>
                <input required type="text" value={newWhName} onChange={e => setNewWhName(e.target.value)} placeholder="e.g. US Warehouse" className="w-full px-4 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (Optional)</label>
                <input type="text" value={newWhLoc} onChange={e => setNewWhLoc(e.target.value)} placeholder="e.g. California, USA" className="w-full px-4 py-2 border rounded-lg outline-none" />
              </div>
              <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2">
                <Plus size={18} /> Create New Warehouse
              </button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouses.map(wh => (
                <div key={wh.id} className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{wh.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> {wh.location || 'No location set'}</p>
                  </div>
                  <span className="text-[10px] bg-white border px-2 py-1 rounded text-slate-400 font-mono">{wh.id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && isSuperAdmin && (
        <div className="animate-slide-up">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" size={20} /> User & Warehouse Permissions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-6 py-3">User</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Warehouse Access</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map(user => (
                      <tr key={user.email} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{user.email}</div>
                          {user.email === 'jhobo@grnesl.com' && <div className="text-[9px] text-blue-500 font-bold uppercase">System Owner</div>}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${user.role === 'super_admin' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                             {user.role.replace('_', ' ')}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.is_approved ? <span className="bg-green-50 text-green-600 px-2 py-1 rounded-full text-[10px] font-bold">ACTIVE</span> : <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-full text-[10px] font-bold">PENDING</span>}
                        </td>
                        <td className="px-6 py-4">
                          {user.role === 'super_admin' ? (
                            <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-fit">
                                <Globe size={12} />
                                <span className="text-[10px] font-bold uppercase">Global Access</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {warehouses.map(wh => (
                                <button 
                                  key={wh.id} 
                                  onClick={() => toggleWarehouseForUser(user.email, wh.id)}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${user.assigned_warehouses.includes(wh.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200 hover:border-blue-400'}`}
                                >
                                  {wh.name}
                                </button>
                              ))}
                              {warehouses.length === 0 && <span className="text-[10px] text-slate-400 italic">No warehouses created</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                           {user.email !== 'jhobo@grnesl.com' && (
                             <button onClick={() => toggleUserStatus(user.email, user.is_approved)} className={`px-3 py-1 rounded-md text-xs font-bold ${user.is_approved ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`}>
                               {user.is_approved ? 'Revoke Access' : 'Approve User'}
                             </button>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="max-w-md animate-slide-up">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Lock className="text-slate-500" size={20} /> Change Password</h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">New Password</label><input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label><input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" /></div>
              {passwordMsg.text && <div className={`p-3 rounded-lg text-sm ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{passwordMsg.text}</div>}
              <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors">Update Password</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'advisor' && <div className="animate-slide-up"><AIAdvisor products={products} /></div>}

      {showSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="text-lg font-bold">SQL Database Migration (Warehouses)</h3>
                    <button onClick={() => setShowSchema(false)}><X size={24} /></button>
                </div>
                <div className="p-0 flex-1 bg-slate-900 overflow-auto">
                    <pre className="p-6 text-xs text-blue-100 font-mono">{sqlSchema}</pre>
                </div>
                <div className="p-4 bg-slate-50 text-right rounded-b-xl">
                     <button onClick={() => { navigator.clipboard.writeText(sqlSchema); alert("SQL Copied!"); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg mr-2 font-bold">Copy SQL</button>
                     <button onClick={() => setShowSchema(false)} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg">Close</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
