
import React, { useState } from 'react';
import { Product, Assignment, ScrappedItem, StockLog } from '../types';
import { Edit, Trash2, Search, Filter, Plus, AlertCircle, ArrowDownCircle, UserPlus, Database } from 'lucide-react';

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

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Controls Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name (EN/CN) or SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative hidden md:block">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button 
              onClick={onInbound}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <ArrowDownCircle size={20} />
              Inbound Stock
            </button>
            <button 
              onClick={onAddProduct}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              New Product
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-3">Product Info</th>
                <th className="px-6 py-3 text-center">Inbound (Total)</th>
                <th className="px-6 py-3 text-center">Assigned (Active)</th>
                <th className="px-6 py-3 text-center">Scrapped (Total)</th>
                <th className="px-6 py-3 text-center">Stock</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const isLowStock = product.quantity <= product.minStock;
                  
                  // Calculations
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
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-sm text-slate-500">{product.nameZh}</div>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-slate-400">SKU: {product.sku}</span>
                             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                {product.category}
                             </span>
                        </div>
                      </td>
                      
                      {/* Stats Columns */}
                      <td className="px-6 py-3 text-center text-sm font-medium text-green-600">
                        {totalInbound > 0 ? totalInbound : '-'}
                      </td>
                      <td className="px-6 py-3 text-center text-sm font-medium text-blue-600">
                        {activeAssigned > 0 ? activeAssigned : '-'}
                      </td>
                      <td className="px-6 py-3 text-center text-sm font-medium text-red-500">
                        {totalScrapped > 0 ? totalScrapped : '-'}
                      </td>

                      <td className="px-6 py-3 text-center">
                         <div className="flex flex-col items-center">
                            <span className="font-mono font-bold text-slate-800 text-lg">{product.quantity}</span>
                            {isLowStock ? (
                                <span className="inline-flex items-center gap-1 text-red-600 text-[10px] font-bold">
                                    <AlertCircle size={10} /> Low Stock
                                </span>
                            ) : (
                                <span className="text-xs text-slate-400">Available</span>
                            )}
                         </div>
                      </td>

                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => onAssign(product)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Assign to Employee"
                          >
                            <UserPlus size={18} />
                          </button>
                          <button 
                            onClick={() => onEditProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => onScrap(product)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Scrap Item"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <Search size={48} className="text-slate-200" />
                      <p>No products found matching your criteria.</p>
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
