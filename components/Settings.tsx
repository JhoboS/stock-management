
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, BrainCircuit, UserCog, ShieldCheck, X, Lock, Database, MapPin, Building2, Globe } from 'lucide-react';
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
    if (!user || user.role === 'super_admin') return;

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

  const sqlSchema = `-- REPAIR TERMINAL: REGIONAL INDEPENDENCE MIGRATION (V2)
-- This script force-removes global constraints to allow identical names across warehouses.

-- 1. Ensure warehouses table exists
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(), 
  name text not null, 
  location text, 
  created_at timestamptz default now()
);

-- 2. Ensure Default "US Warehouse" exists
insert into warehouses (id, name, location)
select '00000000-0000-0000-0000-000000000000', 'US Warehouse', 'United States'
where not exists (select 1 from warehouses where id = '00000000-0000-0000-0000-000000000000');

-- 3. CATEGORIES: Remove global name unique constraints
-- Check all possible constraint names that might exist from default setups
alter table categories drop constraint if exists categories_name_key;
alter table categories drop constraint if exists categories_name_unique;
alter table categories drop constraint if exists categories_pkey; -- In case name was PK

-- Ensure 'id' is the primary key
alter table categories add column if not exists id uuid default gen_random_uuid();
do $$ 
begin 
    if not exists (select 1 from pg_constraint where conname = 'categories_pkey') then
        alter table categories add primary key (id);
    end if;
end $$;

-- Add warehouse_id and migrate orphans
alter table categories add column if not exists warehouse_id uuid references warehouses(id);
update categories set warehouse_id = '00000000-0000-0000-0000-000000000000' where warehouse_id is null;

-- Add COMPOSITE unique constraint (name + warehouse_id)
do $$ 
begin 
    if not exists (select 1 from pg_constraint where conname = 'categories_name_warehouse_unique') then
        alter table categories add constraint categories_name_warehouse_unique unique (name, warehouse_id);
    end if;
end $$;

-- 4. PRODUCTS: Remove global SKU/Name unique constraints
alter table products drop constraint if exists products_sku_key;
alter table products drop constraint if exists products_name_key;

alter table products add column if not exists warehouse_id uuid references warehouses(id);
update products set warehouse_id = '00000000-0000-0000-0000-000000000000' where warehouse_id is null;

-- Add composite unique constraints for Products
do $$ 
begin 
    if not exists (select 1 from pg_constraint where conname = 'products_sku_warehouse_unique') then
        alter table products add constraint products_sku_warehouse_unique unique (sku, warehouse_id);
    end if;
end $$;

-- 5. UPGRADE OTHER TABLES
alter table employees add column if not exists warehouse_id uuid references warehouses(id);
update employees set warehouse_id = '00000000-0000-0000-0000-000000000000' where warehouse_id is null;

alter table assignments add column if not exists warehouse_id uuid references warehouses(id);
update assignments set warehouse_id = '00000000-0000-0000-0000-000000000000' where warehouse_id is null;

alter table scrapped_items add column if not exists warehouse_id uuid references warehouses(id);
update scrapped_items set warehouse_id = '00000000-0000-0000-0000-000000000000' where warehouse_id is null;

alter table stock_logs add column if not exists warehouse_id uuid references warehouses(id);
update stock_logs set warehouse_id = '00000000-0000-0000-0000-000000000000' where warehouse_id is null;

-- 6. User Permissions
alter table app_users add column if not exists assigned_warehouses uuid[] default '{}';

-- Final Reload
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
              <Building2 size={16} /> Regions
            </button>
          </>
        )}
      </div>

      {activeTab === 'general' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Tag className="text-blue-600" size={24} /> Categories</h3>
              {isSuperAdmin && (
                <button onClick={() => setShowSchema(true)} className="flex items-center gap-2 text-[10px] font-black uppercase text-white bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                  <Database size={14} /> System SQL Repair
                </button>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if(newCategory.trim()) { onAddCategory(newCategory.trim()); setNewCategory(''); }}} className="flex gap-3 mb-8">
              <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New regional category..." className="flex-1 px-5 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-slate-50/50" />
              <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all">Add Category</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <div key={category} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all group">
                  <span className="font-bold text-slate-700">{category}</span>
                  <button onClick={() => onDeleteCategory(category)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
        </div>
      )}

      {activeTab === 'warehouses' && isSuperAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><Building2 className="text-amber-600" size={28} /> Regional Hubs</h3>
          <form onSubmit={handleCreateWarehouse} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
            <div className="col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Region Name</label>
              <input required type="text" value={newWhName} onChange={e => setNewWhName(e.target.value)} placeholder="e.g. Asia-Pacific" className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50/50" />
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Location Details</label>
              <input type="text" value={newWhLoc} onChange={e => setNewWhLoc(e.target.value)} placeholder="e.g. Hong Kong, SAR" className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50/50" />
            </div>
            <button type="submit" className="bg-amber-600 text-white h-[52px] rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-700 transition-all shadow-xl shadow-amber-500/20">Create Hub</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {warehouses.map(wh => (
              <div key={wh.id} className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl flex items-center justify-between hover:border-amber-200 transition-all">
                <div>
                  <h4 className="text-lg font-black text-slate-900">{wh.name}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><MapPin size={12} className="text-amber-600" /> {wh.location || 'Global Location'}</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-400 font-mono shadow-sm">{wh.id.substring(0,8)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && isSuperAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><ShieldCheck className="text-blue-600" size={28} /> Permissions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="px-6 py-4">Security Profile</th>
                  <th className="px-6 py-4">Role Designation</th>
                  <th className="px-6 py-4">Region Access Control</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allUsers.map(user => (
                  <tr key={user.email} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900">{user.email}</div>
                      {user.email === 'jhobo@grnesl.com' && <div className="text-[9px] text-blue-600 font-black uppercase mt-1">System Founder</div>}
                    </td>
                    <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${user.role === 'super_admin' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                    </td>
                    <td className="px-6 py-5">
                      {user.role === 'super_admin' ? (
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 w-fit">
                            <Globe size={12} /> Global Master Access
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {warehouses.map(wh => (
                            <button key={wh.id} onClick={() => toggleWarehouseForUser(user.email, wh.id)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all ${user.assigned_warehouses.includes(wh.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200 hover:border-blue-300'}`}>
                              {wh.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                       {user.email !== 'jhobo@grnesl.com' && (
                         <button onClick={() => toggleUserStatus(user.email, user.is_approved)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${user.is_approved ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}>
                           {user.is_approved ? 'Revoke Session' : 'Grant Entry'}
                         </button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="max-w-md">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><Lock className="text-slate-500" size={24} /> Security</h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">New System Password</label><input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50/50" /></div>
              <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Verify Password</label><input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50/50" /></div>
              {passwordMsg.text && <div className={`p-4 rounded-2xl text-xs font-bold ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{passwordMsg.text}</div>}
              <button type="submit" className="w-full bg-slate-900 text-white font-black uppercase text-xs tracking-widest py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl">Update Credentials</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'advisor' && <AIAdvisor products={products} />}

      {showSchema && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">Database Repair Terminal</h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Initializes regional hubs and migrates legacy data to US Warehouse.</p>
                    </div>
                    <button onClick={() => setShowSchema(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
                </div>
                <div className="p-0 flex-1 bg-slate-900 overflow-auto">
                    <pre className="p-8 text-xs text-blue-300 font-mono leading-relaxed">{sqlSchema}</pre>
                </div>
                <div className="p-6 bg-slate-50 flex items-center justify-between border-t border-slate-200">
                     <p className="text-[10px] font-bold text-slate-500 max-w-xs">Run this script in your Supabase SQL Editor to complete regional setup.</p>
                     <div className="flex gap-3">
                        <button onClick={() => { navigator.clipboard.writeText(sqlSchema); alert("SQL Migration script copied to clipboard!"); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">Copy Migration Script</button>
                        <button onClick={() => setShowSchema(false)} className="px-6 py-3 bg-white text-slate-700 border border-slate-200 font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-slate-50">Dismiss</button>
                     </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
