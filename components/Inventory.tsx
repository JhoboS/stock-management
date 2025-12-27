
import React, { useState } from 'react';
import { Product, Assignment, ScrappedItem, StockLog } from '../types';
import { Edit, Trash2, Search, Filter, Plus, AlertCircle, ArrowDownCircle, UserPlus, Package, Box } from 'lucide-react';

interface InventoryProps {
  products: Product[];
  categories: string[];
  assignments: Assignment[];
  scrappedItems: ScrappedItem[];
  logs: StockLog[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onInbound: () => void;
  onAssign: (product: Product) => void;
  onScrap: (product: Product) => void;
}

const Inventory: React.FC<InventoryProps> = ({ 
  products, categories, assignments, scrappedItems, logs,
  onAddProduct, onEditProduct, onDeleteProduct,
  onInbound, onAssign, onScrap
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product.nameZh && product.nameZh.includes(searchTerm)) ||
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const buttonClass = "flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm";

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Controls Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search assets (EN/CN) or SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full md:w-48 pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer text-sm font-medium"
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button onClick={onInbound} className={buttonClass}>
              <ArrowDownCircle size={16} className="text-emerald-500" />
              Inbound
            </button>
            <button onClick={onAddProduct} className={buttonClass}>
              <Plus size={16} className="text-blue-600" />
              Create
            </button>
        </div>
      </div>

      {/* Mobile-Optimized Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredProducts.map((product) => {
          const isLowStock = product.quantity <= product.minStock;
          const totalVal = product.quantity * product.price;
          return (
            <div key={product.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
               <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-slate-900 leading-tight">{product.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{product.nameZh || 'No Chinese Name'}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200">{product.category}</span>
                       <span className="text-[9px] font-mono text-slate-400">SKU: {product.sku}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${isLowStock ? 'text-red-500' : 'text-slate-900'}`}>{product.quantity}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Units Left</p>
                    <p className="text-[10px] font-black text-emerald-600 mt-1">${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                  <button onClick={() => onAssign(product)} className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                    <UserPlus size={14} /> Assign
                  </button>
                  <button onClick={() => onEditProduct(product)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                    <Edit size={14} /> Edit
                  </button>
                  <button onClick={() => onScrap(product)} className="w-12 bg-red-50 text-red-500 py-3 rounded-xl flex items-center justify-center">
                    <Trash2 size={16} />
                  </button>
               </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-4">Asset Identification</th>
                <th className="px-4 py-4 text-center">Inbound Hist.</th>
                <th className="px-4 py-4 text-center">Active Usage</th>
                <th className="px-4 py-4 text-center">Scrap Count</th>
                <th className="px-6 py-4 text-center">Available Stock</th>
                <th className="px-6 py-4 text-center">Total Value</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const isLowStock = product.quantity <= product.minStock;
                  const totalValue = product.quantity * product.price;
                  
                  const totalInbound = logs
                      .filter(l => (l.productName === product.name) && (l.action === 'INBOUND' || l.action === 'CREATE'))
                      .reduce((acc, l) => acc + l.quantity, 0);
                  
                  const activeAssigned = assignments
                      .filter(a => a.productId === product.id && a.status === 'Active')
                      .reduce((acc, a) => acc + a.quantity, 0);

                  const totalScrapped = scrappedItems
                      .filter(s => s.productId === product.id)
                      .reduce((acc, s) => acc + s.quantity, 0);

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                           <div className="font-black text-slate-900 leading-none">{product.name}</div>
                           <div className="text-xs text-slate-400 mt-1 font-medium">{product.nameZh}</div>
                           <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">SKU: {product.sku}</span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase bg-white border border-slate-200 text-slate-500">
                                   {product.category}
                                </span>
                           </div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-5 text-center text-sm font-black text-emerald-600">
                        {totalInbound > 0 ? `+${totalInbound}` : '-'}
                      </td>
                      <td className="px-4 py-5 text-center text-sm font-black text-blue-600">
                        {activeAssigned > 0 ? activeAssigned : '-'}
                      </td>
                      <td className="px-4 py-5 text-center text-sm font-black text-red-400">
                        {totalScrapped > 0 ? totalScrapped : '-'}
                      </td>

                      <td className="px-6 py-5 text-center">
                         <div className="flex flex-col items-center">
                            <span className={`font-mono font-black text-sm ${isLowStock ? 'text-red-500' : 'text-slate-900'}`}>{product.quantity}</span>
                            {isLowStock && (
                                <span className="inline-flex items-center gap-1 text-red-500 text-[9px] font-black uppercase mt-1">
                                    <AlertCircle size={10} /> CRITICAL
                                </span>
                            )}
                         </div>
                      </td>

                      <td className="px-6 py-5 text-center text-sm font-black text-slate-900">
                        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onAssign(product)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Assign">
                            <UserPlus size={18} />
                          </button>
                          <button onClick={() => onEditProduct(product)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Edit">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => onScrap(product)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Scrap">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-4">
                      <Package size={64} className="text-slate-100" strokeWidth={1} />
                      <p className="font-black uppercase text-xs tracking-widest text-slate-300">Warehouse inventory is empty</p>
                    </div>
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

export default Inventory;
