
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, BrainCircuit, UserCog, ShieldCheck, X, Lock, Database, MapPin, Building2, Globe, Package } from 'lucide-react';
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

  const sqlSchema = `-- REPAIR TERMINAL: FULL DATABASE GENERATION (V4.3)
-- Run this to fix "Failed to fetch" errors and missing tables.

-- 1. CORE ARCHITECTURE
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(), 
  name text not null, 
  location text, 
  created_at timestamptz default now()
);

create table if not exists app_users (
  id uuid primary key references auth.users(id),
  email text unique not null,
  is_approved boolean default false,
  role text default 'user',
  assigned_warehouses uuid[] default '{}',
  created_at timestamptz default now()
);

-- 2. INVENTORY & TAXONOMY
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id),
  name text not null,
  name_zh text,
  sku text,
  category text,
  quantity integer default 0,
  price numeric default 0,
  min_stock integer default 5,
  description text,
  last_updated timestamptz default now(),
  created_at timestamptz default now()
);

-- 3. STAFF & TRANSACTIONS
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id),
  name text not null,
  email text,
  department text,
  role text,
  joined_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id),
  product_id uuid references products(id),
  product_name text,
  product_name_zh text,
  employee_id uuid references employees(id),
  employee_name text,
  quantity integer default 1,
  assigned_date timestamptz default now(),
  status text default 'Active',
  performed_by text,
  created_at timestamptz default now()
);

create table if not exists scrapped_items (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id),
  product_id uuid references products(id),
  product_name text,
  product_name_zh text,
  quantity integer default 1,
  reason text,
  scrapped_date timestamptz default now(),
  performed_by text,
  created_at timestamptz default now()
);

create table if not exists stock_logs (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id),
  action text not null,
  product_name text not null,
  quantity integer not null,
  performed_by text not null,
  date timestamptz default now(),
  details text,
  created_at timestamptz default now()
);

-- 4. SECURITY & PERMISSIONS
alter table warehouses enable row level security;
alter table app_users enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table employees enable row level security;
alter table assignments enable row level security;
alter table scrapped_items enable row level security;
alter table stock_logs enable row level security;

-- Identity Helper
create or replace function is_super_admin() returns boolean as $$
  begin
    return (select auth.jwt()->>'email' = 'jhobo@grnesl.com');
  end;
$$ language plpgsql security definer;

-- REGIONAL RLS POLICIES (Using unnest for array comparison)
drop policy if exists "Regional log access" on stock_logs;
create policy "Regional log access" on stock_logs for all
using (is_super_admin() or warehouse_id in (select unnest(assigned_warehouses) from app_users where id = auth.uid()));

drop policy if exists "Regional product access" on products;
create policy "Regional product access" on products for all
using (is_super_admin() or warehouse_id in (select unnest(assigned_warehouses) from app_users where id = auth.uid()));

-- SEED DATA
insert into warehouses (id, name, location)
select '00000000-0000-0000-0000-000000000000', 'US Warehouse', 'United States'
where not exists (select 1 from warehouses where id = '00000000-0000-0000-0000-000000000000');

NOTIFY pgrst, 'reload config';
`;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
       <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit mb-6 overflow-x-auto no-scrollbar scroll-smooth">
        <button onClick={() => setActiveTab('general')} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'general' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Tag size={16} /> Category
        </button>
        <button onClick={() => setActiveTab('account')} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'account' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <UserCog size={16} /> Password
        </button>
        <button onClick={() => setActiveTab('advisor')} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'advisor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BrainCircuit size={16} /> AI Assistant
        </button>
        {isSuperAdmin && (
          <>
            <button onClick={() => setActiveTab('users')} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ShieldCheck size={16} /> Access
            </button>
            <button onClick={() => setActiveTab('warehouses')} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === 'warehouses' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Building2 size={16} /> Regions
            </button>
          </>
        )}
      </div>

      {activeTab === 'general' && (
        <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3"><Tag className="text-blue-600" size={24} /> Category Settings</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Manage categorization for the current regional warehouse.</p>
              </div>
              {isSuperAdmin && (
                <button onClick={() => setShowSchema(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                  <Database size={14} /> System SQL Repair (V4.3)
                </button>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if(newCategory.trim()) { onAddCategory(newCategory.trim()); setNewCategory(''); }}} className="flex flex-col sm:flex-row gap-3 mb-10">
              <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New regional category..." className="flex-1 px-5 py-3.5 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-slate-50/50 text-sm" />
              <button type="submit" className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">Add Category</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => {
                const productCount = products.filter(p => p.category === category).length;
                const isLocked = productCount > 0;
                
                return (
                  <div key={category} className={`flex items-center justify-between p-5 bg-white border rounded-3xl transition-all group ${isLocked ? 'border-slate-50 opacity-70' : 'border-slate-100 hover:border-blue-200 shadow-sm'}`}>
                    <div className="flex flex-col">
                        <span className="font-black text-slate-800 tracking-tight">{category}</span>
                        <span className={`text-[10px] font-black uppercase flex items-center gap-1.5 mt-1 ${isLocked ? 'text-blue-500' : 'text-slate-400'}`}>
                            <Package size={10} /> {productCount} {productCount === 1 ? 'Asset' : 'Assets'}
                        </span>
                    </div>
                    <button 
                      onClick={() => onDeleteCategory(category)} 
                      className={`transition-colors p-2.5 rounded-xl ${isLocked ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                      disabled={isLocked}
                      title={isLocked ? "Cannot delete category with products" : "Delete category"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
        </div>
      )}

      {activeTab === 'warehouses' && isSuperAdmin && (
        <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><Building2 className="text-amber-600" size={28} /> Regional Hubs</h3>
          <form onSubmit={handleCreateWarehouse} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 items-end">
            <div className="col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Region Name</label>
              <input required type="text" value={newWhName} onChange={e => setNewWhName(e.target.value)} placeholder="e.g. Asia-Pacific" className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl outline-none bg-slate-50/50 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Location Details</label>
              <input type="text" value={newWhLoc} onChange={e => setNewWhLoc(e.target.value)} placeholder="e.g. Hong Kong, SAR" className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl outline-none bg-slate-50/50 text-sm" />
            </div>
            <button type="submit" className="bg-amber-600 text-white h-[52px] rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-700 transition-all shadow-xl shadow-amber-500/20">Create Hub</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warehouses.map(wh => (
              <div key={wh.id} className="p-6 bg-slate-50/50 border border-slate-100 rounded-[28px] flex items-center justify-between hover:bg-white hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/5 transition-all">
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-tight">{wh.name}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1.5 font-medium"><MapPin size={12} className="text-amber-600" /> {wh.location || 'Global Location'}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-[9px] bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-400 font-mono shadow-sm">{wh.id.substring(0,8)}</span>
                    <span className="text-[9px] font-black uppercase text-slate-300">Region ID</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && isSuperAdmin && (
        <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><ShieldCheck className="text-blue-600" size={28} /> Access Control</h3>
          <div className="overflow-x-auto -mx-6 md:mx-0">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                  <th className="px-6 py-4">Security Profile</th>
                  <th className="px-6 py-4">Role Designation</th>
                  <th className="px-6 py-4">Region Access Control</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allUsers.map(user => (
                  <tr key={user.email} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-6">
                      <div className="font-black text-slate-900">{user.email}</div>
                      {user.email === 'jhobo@grnesl.com' && <div className="text-[9px] text-blue-600 font-black uppercase mt-1 tracking-tighter">System Founder</div>}
                    </td>
                    <td className="px-6 py-6">
                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border ${user.role === 'super_admin' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white text-slate-500 border-slate-200'}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                    </td>
                    <td className="px-6 py-6">
                      {user.role === 'super_admin' ? (
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 w-fit">
                            <Globe size={12} /> Master Account
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
                    <td className="px-6 py-6 text-right">
                       {user.email !== 'jhobo@grnesl.com' && (
                         <button onClick={() => toggleUserStatus(user.email, user.is_approved)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${user.is_approved ? 'text-red-600 bg-red-50 hover:bg-red-600 hover:text-white' : 'text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white'}`}>
                           {user.is_approved ? 'Revoke' : 'Grant'}
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
        <div className="max-w-md mx-auto md:mx-0">
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><Lock className="text-slate-400" size={24} /> Password Settings</h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">New System Password</label><input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl outline-none bg-slate-50/50 text-sm" /></div>
              <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Verify Password</label><input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-5 py-3.5 border border-slate-200 rounded-2xl outline-none bg-slate-50/50 text-sm" /></div>
              {passwordMsg.text && <div className={`p-5 rounded-2xl text-xs font-bold shadow-sm ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>{passwordMsg.text}</div>}
              <button type="submit" className="w-full bg-slate-900 text-white font-black uppercase text-xs tracking-widest py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl">Update Password</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'advisor' && <AIAdvisor products={products} />}

      {showSchema && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Database size={24} className="text-blue-600" /> System SQL Repair
                  </h2>
                  <button onClick={() => setShowSchema(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto bg-slate-50 font-mono text-[10px] whitespace-pre-wrap flex-1">
                  {sqlSchema}
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setShowSchema(false)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest">
                    Close
                  </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
