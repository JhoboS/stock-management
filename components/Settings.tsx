import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Tag, AlertTriangle, BrainCircuit, UserCog, ShieldCheck, Check, X, Lock, Database } from 'lucide-react';
import AIAdvisor from './AIAdvisor';
import { Product, Assignment, ScrappedItem, Employee, AppUser } from '../types';
import { supabase } from '../services/supabaseClient';
import { fetchAllUsers, updateUserStatus } from '../services/storageService';

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
}

const Settings: React.FC<SettingsProps> = ({ 
  categories, products, assignments, scrappedItems, employees,
  onAddCategory, onDeleteCategory, onImportData, currentUser 
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'advisor' | 'account' | 'users'>('general');
  const [newCategory, setNewCategory] = useState('');
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  
  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // Schema Modal State
  const [showSchema, setShowSchema] = useState(false);

  // Load Users if Admin
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.email === 'jhobo@grnesl.com';

  useEffect(() => {
    if (activeTab === 'users' && isSuperAdmin) {
      loadUsers();
    }
  }, [activeTab, isSuperAdmin]);

  const loadUsers = async () => {
    try {
      const users = await fetchAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleUserStatus = async (email: string, currentStatus: boolean) => {
    try {
      await updateUserStatus(email, !currentStatus);
      // Optimistic update
      setAllUsers(allUsers.map(u => u.email === email ? { ...u, is_approved: !currentStatus } : u));
    } catch (error) {
      alert("Failed to update user status");
    }
  };
  
  // Modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    category: string;
    type: 'CONFIRM' | 'BLOCKED';
    count?: number;
  }>({
    isOpen: false,
    category: '',
    type: 'CONFIRM'
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategory.trim()) {
      onAddCategory(newCategory.trim());
      setNewCategory('');
    }
  };

  const handleRequestDelete = (category: string) => {
    // Check if category has items
    const count = products.filter(p => p.category === category).length;
    
    if (count > 0) {
      setDeleteModal({
        isOpen: true,
        category,
        type: 'BLOCKED',
        count
      });
    } else {
      setDeleteModal({
        isOpen: true,
        category,
        type: 'CONFIRM'
      });
    }
  };

  const confirmDelete = () => {
    onDeleteCategory(deleteModal.category);
    setDeleteModal(prev => ({ ...prev, isOpen: false }));
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password' });
    }
  };

  const sqlSchema = `-- REPAIR SCRIPT: Run this in Supabase SQL Editor
-- This script safely adds missing columns to existing tables.

-- 1. Force Cache Reload (Clear stale config)
NOTIFY pgrst, 'reload config';

-- 2. PRODUCTS: Add missing columns
create table if not exists products (id text primary key, name text not null);
alter table products add column if not exists name_zh text;
alter table products add column if not exists sku text;
alter table products add column if not exists category text;
alter table products add column if not exists quantity numeric default 0;
alter table products add column if not exists price numeric default 0;
alter table products add column if not exists min_stock numeric default 0;
alter table products add column if not exists description text;
alter table products add column if not exists last_updated timestamptz default now();

-- 3. EMPLOYEES: Add missing columns
create table if not exists employees (id text primary key, name text not null);
alter table employees add column if not exists email text;
alter table employees add column if not exists department text;
alter table employees add column if not exists role text;
alter table employees add column if not exists joined_date timestamptz default now();

-- 4. ASSIGNMENTS: Add missing columns
create table if not exists assignments (id uuid primary key default gen_random_uuid());
alter table assignments add column if not exists product_id text;
alter table assignments add column if not exists product_name text;
alter table assignments add column if not exists product_name_zh text;
alter table assignments add column if not exists employee_id text;
alter table assignments add column if not exists employee_name text;
alter table assignments add column if not exists quantity numeric;
alter table assignments add column if not exists assigned_date timestamptz default now();
alter table assignments add column if not exists status text;
alter table assignments add column if not exists performed_by text;

-- 5. SCRAPPED ITEMS: Add missing columns
create table if not exists scrapped_items (id uuid primary key default gen_random_uuid());
alter table scrapped_items add column if not exists product_id text;
alter table scrapped_items add column if not exists product_name text;
alter table scrapped_items add column if not exists product_name_zh text;
alter table scrapped_items add column if not exists quantity numeric;
alter table scrapped_items add column if not exists reason text;
alter table scrapped_items add column if not exists scrapped_date timestamptz default now();
alter table scrapped_items add column if not exists performed_by text;

-- 6. STOCK LOGS
create table if not exists stock_logs (id uuid primary key default gen_random_uuid());
alter table stock_logs add column if not exists action text;
alter table stock_logs add column if not exists product_name text;
alter table stock_logs add column if not exists quantity numeric;
alter table stock_logs add column if not exists performed_by text;
alter table stock_logs add column if not exists date timestamptz default now();
alter table stock_logs add column if not exists details text;

-- 7. CATEGORIES
create table if not exists categories (id bigint generated by default as identity primary key, name text unique not null);

-- 8. USERS
create table if not exists app_users (id uuid primary key, email text unique not null);
alter table app_users add column if not exists is_approved boolean default false;
alter table app_users add column if not exists role text default 'user';
alter table app_users add column if not exists created_at timestamptz default now();

-- 9. Final Cache Reload (Apply changes)
NOTIFY pgrst, 'reload config';
`;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
       <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'general' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
            <Tag size={16} />
            General
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'account' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
            <UserCog size={16} />
            My Account
        </button>
        <button
          onClick={() => setActiveTab('advisor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'advisor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
            <BrainCircuit size={16} />
            AI Advisor
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
              <ShieldCheck size={16} />
              User Management
          </button>
        )}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6 animate-slide-up">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Tag className="text-blue-600" size={20} />
                    Category Management
                  </h3>
                  <button 
                    onClick={() => setShowSchema(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors shadow-sm shadow-blue-200"
                  >
                    <Database size={14} />
                    View Database Schema
                  </button>
                </div>

                <form onSubmit={handleAdd} className="flex gap-3 mb-8">
                <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Enter new category name..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
                <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <Plus size={18} />
                    Add Category
                </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                    <div 
                    key={category} 
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group hover:border-blue-200 transition-colors"
                    >
                    <span className="font-medium text-slate-700">{category}</span>
                    <button
                        type="button"
                        onClick={() => handleRequestDelete(category)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                        title="Delete Category"
                    >
                        <Trash2 size={16} />
                    </button>
                    </div>
                ))}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="max-w-md animate-slide-up">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Lock className="text-slate-500" size={20} />
              Change Password
            </h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>
              
              {passwordMsg.text && (
                <div className={`p-3 rounded-lg text-sm ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {passwordMsg.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'users' && isSuperAdmin && (
        <div className="animate-slide-up">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" size={20} />
                User Approvals
              </h3>
              <p className="text-slate-500 mb-6">Authorize which users can access the system. Users must be approved to login.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map(user => (
                      <tr key={user.email} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{user.email}</td>
                        <td className="px-6 py-4 text-slate-500 capitalize">{user.role}</td>
                        <td className="px-6 py-4">
                          {user.is_approved ? (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2 py-1 rounded-full text-xs font-bold">
                              <Check size={12} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-full text-xs font-bold">
                              <Lock size={12} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                           {user.email !== 'jhobo@grnesl.com' && (
                             <button
                               onClick={() => toggleUserStatus(user.email, user.is_approved)}
                               className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                                 user.is_approved 
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                               }`}
                             >
                               {user.is_approved ? 'Revoke Access' : 'Approve User'}
                             </button>
                           )}
                        </td>
                      </tr>
                    ))}
                    {allUsers.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-400">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'advisor' && (
          <div className="animate-slide-up">
              <AIAdvisor products={products} />
          </div>
      )}

      {/* Delete Category Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="text-center mb-6">
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                deleteModal.type === 'BLOCKED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {deleteModal.type === 'BLOCKED' ? <AlertTriangle size={24} /> : <Trash2 size={24} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {deleteModal.type === 'BLOCKED' ? 'Cannot Delete Category' : 'Delete Category?'}
              </h3>
              <p className="text-slate-500 text-sm">
                {deleteModal.type === 'BLOCKED' 
                  ? `The category "${deleteModal.category}" contains ${deleteModal.count} product(s). Please remove or reassign these items before deleting the category.`
                  : `Are you sure you want to permanently delete the "${deleteModal.category}" category? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              {deleteModal.type === 'BLOCKED' ? (
                <button 
                  onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full bg-slate-100 text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Understood
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 bg-slate-100 text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 bg-red-600 text-white font-medium py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Schema Modal */}
      {showSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Database Setup (Repair)</h3>
                        <p className="text-sm text-slate-500">Run this SQL in your Supabase SQL Editor to add missing columns to existing tables.</p>
                    </div>
                    <button onClick={() => setShowSchema(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-0 overflow-hidden flex-1 relative bg-slate-900">
                    <pre className="p-6 text-xs text-blue-100 font-mono overflow-auto h-full w-full">
                        {sqlSchema}
                    </pre>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(sqlSchema);
                            alert("SQL copied to clipboard!");
                        }}
                        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs font-bold backdrop-blur-sm border border-white/20 transition-colors"
                    >
                        Copy SQL
                    </button>
                </div>
                <div className="p-4 bg-slate-50 text-right rounded-b-xl border-t border-slate-200">
                     <button 
                        onClick={() => setShowSchema(false)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors"
                    >
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