
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import ProductModal from './components/ProductModal';
import StockOperationModal from './components/StockOperationModal';
import Employees from './components/Employees';
import Settings from './components/Settings';
import Login from './components/Login';
import Logs from './components/Logs'; 
import { 
  fetchProducts, upsertProduct, deleteProductApi,
  fetchAssignments, addAssignmentApi, returnAssignmentApi,
  fetchScrappedItems, addScrappedItemApi,
  fetchEmployees, addEmployeeApi,
  fetchCategories, addCategoryApi, deleteCategoryApi,
  fetchAppUser, createAppUser, addStockLogApi, fetchStockLogs, fetchWarehouses
} from './services/storageService';
import { supabase, isConfigured } from './services/supabaseClient';
import { Product, Assignment, ScrappedItem, OperationType, Employee, AppUser, StockLog, Warehouse } from './types';
import { Loader2, Database, AlertTriangle, Lock, XCircle, Building2, ChevronDown, Check, Layout } from 'lucide-react';

const SUPER_ADMIN_EMAIL = 'jhobo@grnesl.com';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Multi-Warehouse State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>('');
  const [isWhMenuOpen, setIsWhMenuOpen] = useState(false);

  // Data State
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scrappedItems, setScrappedItems] = useState<ScrappedItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isStockOpModalOpen, setIsStockOpModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<OperationType>('INBOUND');
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | undefined>(undefined);

  // Active Warehouse Object
  const activeWarehouse = useMemo(() => warehouses.find(w => w.id === activeWarehouseId), [warehouses, activeWarehouseId]);
  
  // Restricted warehouses for current user
  const userWarehouses = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin') return warehouses;
    return warehouses.filter(w => currentUser.assigned_warehouses.includes(w.id));
  }, [warehouses, currentUser]);

  useEffect(() => {
    if (!isConfigured) { setIsLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkUserAndLoad = async () => {
      if (session && isConfigured) {
        setIsLoading(true);
        const email = session.user.email;
        try {
          const allWh = await fetchWarehouses();
          setWarehouses(allWh);

          let appUser = await fetchAppUser(email);
          
          // CRITICAL: Self-healing logic for Super Admin
          if (email === SUPER_ADMIN_EMAIL) {
            const superAdminUser: AppUser = { 
              id: session.user.id, 
              email, 
              role: 'super_admin', 
              is_approved: true, 
              assigned_warehouses: appUser?.assigned_warehouses || [] 
            };
            
            // If user doesn't exist in our table yet, create them
            if (!appUser) {
              await createAppUser(superAdminUser);
            }
            appUser = superAdminUser;
          } else if (!appUser) {
            appUser = { id: session.user.id, email, role: 'user', is_approved: false, assigned_warehouses: [] };
            await createAppUser(appUser);
          }

          setCurrentUser(appUser);
          if (appUser.is_approved) {
            setIsApproved(true);
            // Default to first assigned warehouse or first existing if super admin
            const initialWhId = appUser.role === 'super_admin' ? allWh[0]?.id : appUser.assigned_warehouses[0];
            if (initialWhId) {
                setActiveWarehouseId(initialWhId);
            }
          }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
      }
    };
    checkUserAndLoad();
  }, [session]);

  // Re-fetch data whenever the warehouse changes
  useEffect(() => {
    if (activeWarehouseId && isApproved) {
        loadData();
    }
  }, [activeWarehouseId, isApproved]);

  const handleError = (error: any) => {
    const msg = error.message || "Unknown error";
    if (msg.includes('column') || msg.includes('relation') || msg.includes('does not exist')) {
        setSchemaError("Database Schema Mismatch: Multi-Warehouse columns missing. Go to Settings > SQL Repair.");
    }
  };

  const loadData = async () => {
    if (!activeWarehouseId) return;
    try {
      const [prod, assign, scrap, emp, cats, logs] = await Promise.all([
        fetchProducts(activeWarehouseId),
        fetchAssignments(activeWarehouseId),
        fetchScrappedItems(activeWarehouseId),
        fetchEmployees(activeWarehouseId),
        fetchCategories(activeWarehouseId),
        fetchStockLogs(activeWarehouseId)
      ]);
      setProducts(prod); setAssignments(assign); setScrappedItems(scrap); setEmployees(emp); setCategories(cats); setStockLogs(logs);
      setSchemaError(null); 
    } catch (error: any) { handleError(error); }
  };

  const handleSaveProduct = async (product: Product) => {
    try {
      const pWithWh = { ...product, warehouseId: activeWarehouseId };
      await upsertProduct(pWithWh);
      await loadData();
    } catch (error: any) { alert(`Failed: ${error.message}`); }
  };

  const handleStockOperation = async (data: any) => {
    const { productId, quantity, type, employeeId, employeeName, reason, productName, productNameZh } = data;
    const userEmail = session.user.email;
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const newQuantity = type === 'INBOUND' ? product.quantity + quantity : Math.max(0, product.quantity - quantity);
      const updatedProduct = { ...product, quantity: newQuantity, lastUpdated: new Date().toISOString() };
      await upsertProduct(updatedProduct);

      if (type === 'ASSIGN') {
        const newAssignment: Assignment = { id: crypto.randomUUID(), warehouseId: activeWarehouseId, productId, productName, productNameZh: productNameZh || '', employeeId, employeeName, quantity, assignedDate: new Date().toISOString(), status: 'Active', performedBy: userEmail };
        await addAssignmentApi(newAssignment);
        await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'ASSIGN', productName, quantity, performedBy: userEmail, date: new Date().toISOString(), details: `Assigned to ${employeeName}` });
      } else if (type === 'SCRAP') {
        const newScrap: ScrappedItem = { id: crypto.randomUUID(), warehouseId: activeWarehouseId, productId, productName, productNameZh: productNameZh || '', quantity, reason, scrappedDate: new Date().toISOString(), performedBy: userEmail };
        await addScrappedItemApi(newScrap);
        await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'SCRAP', productName, quantity, performedBy: userEmail, date: new Date().toISOString(), details: `Reason: ${reason}` });
      } else if (type === 'INBOUND') {
         await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'INBOUND', productName: product.name, quantity, performedBy: userEmail, date: new Date().toISOString() });
      }
      await loadData();
    } catch (error: any) { handleError(error); }
  };

  const handleReturnAsset = async (assignment: Assignment) => {
      try {
        const product = products.find(p => p.id === assignment.productId);
        if (product) {
            await upsertProduct({ ...product, quantity: product.quantity + assignment.quantity, lastUpdated: new Date().toISOString() });
        }
        await returnAssignmentApi(assignment.id);
        await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'RETURN', productName: assignment.productName, quantity: assignment.quantity, performedBy: session.user.email, date: new Date().toISOString(), details: `Returned from ${assignment.employeeName}` });
        await loadData();
      } catch (error: any) { handleError(error); }
  };

  const handleAddEmployee = async (newEmployee: Employee) => {
    try {
      await addEmployeeApi({ ...newEmployee, warehouseId: activeWarehouseId });
      await loadData();
    } catch (error: any) { handleError(error); }
  };

  const handleAddCategory = async (cat: string) => {
      if (!categories.includes(cat)) {
          try { await addCategoryApi(cat, activeWarehouseId); await loadData(); } catch (e: any) { handleError(e); }
      }
  };

  const handleDeleteCategory = async (cat: string) => {
      try { await deleteCategoryApi(cat, activeWarehouseId); await loadData(); } catch (e) { alert("Failed"); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (!session) return <Login />;
  
  // Show loading during initialization
  if (isLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="animate-spin text-blue-600" size={48} /><p className="font-medium animate-pulse text-slate-600">Checking system access...</p></div>;

  // LOCKOUT LOGIC: Only lock out if NOT approved. 
  // Super admins are self-healingly approved in useEffect.
  if (!isApproved) {
     return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-10 text-center animate-fade-in">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={40} /></div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
                <p className="text-slate-500 mb-6">Your account requires approval from the system owner to access the warehouse management system.</p>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 mb-6 font-medium">Contact System Owner: jhobo@grnesl.com</div>
                <button onClick={handleLogout} className="text-blue-600 hover:text-blue-800 font-bold transition-colors">Sign Out and Try Again</button>
            </div>
        </div>
     );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 relative flex-col">
      {schemaError && <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-50"><div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle size={18} />{schemaError}</div><button onClick={() => setCurrentView('settings')} className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-slate-100 transition-colors">Go to Settings</button></div>}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
            <div className="max-w-7xl mx-auto">
            <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 capitalize">{currentView}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 font-medium">Warehouse Context:</span>
                    <div className="relative">
                        <button onClick={() => setIsWhMenuOpen(!isWhMenuOpen)} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold text-blue-600 shadow-sm hover:border-blue-400 transition-all">
                            <Building2 size={14} /> {activeWarehouse?.name || 'Create First Warehouse'} <ChevronDown size={14} />
                        </button>
                        {isWhMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-fade-in ring-1 ring-black/5">
                                <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 border-b mb-1">Select Active Region</div>
                                {userWarehouses.map(wh => (
                                    <button 
                                        key={wh.id} 
                                        onClick={() => { setActiveWarehouseId(wh.id); setIsWhMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${activeWarehouseId === wh.id ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'}`}
                                    >
                                        <span className="flex items-center gap-2 truncate"><Building2 size={14} className="opacity-40" /> {wh.name}</span>
                                        {activeWarehouseId === wh.id && <Check size={14} />}
                                    </button>
                                ))}
                                {userWarehouses.length === 0 && (
                                  <div className="p-4 text-center">
                                    <p className="text-xs text-slate-400 italic mb-2">No warehouses found.</p>
                                    <button onClick={() => { setCurrentView('settings'); setIsWhMenuOpen(false); }} className="text-[10px] text-blue-600 font-bold uppercase hover:underline">Add in Settings</button>
                                  </div>
                                )}
                            </div>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900">{session.user.email}</p>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase">{currentUser?.role.replace('_', ' ')}</span>
                      <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase hover:underline">Sign Out</button>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-md select-none">{session.user.email?.substring(0,2).toUpperCase()}</div>
                </div>
            </header>

            {!activeWarehouseId && currentUser?.role === 'super_admin' && currentView !== 'settings' ? (
               <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-20 text-center animate-slide-up">
                  <Building2 size={64} className="mx-auto text-slate-300 mb-6" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome to Great River System</h3>
                  <p className="text-slate-500 mb-8 max-w-sm mx-auto">As the Super Admin, your first step is to create a warehouse region in the settings.</p>
                  <button onClick={() => setCurrentView('settings')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 mx-auto">
                    <Layout size={20} />
                    Go to Settings
                  </button>
               </div>
            ) : (
              <>
                {currentView === 'dashboard' && <Dashboard products={products} />}
                {currentView === 'inventory' && <Inventory products={products} categories={categories} assignments={assignments} scrappedItems={scrappedItems} logs={stockLogs} onAddProduct={() => { setEditingProduct(undefined); setIsProductModalOpen(true); }} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true); }} onDeleteProduct={deleteProductApi} onInbound={() => { setStockOpType('INBOUND'); setSelectedStockProduct(undefined); setIsStockOpModalOpen(true); }} onAssign={(p) => { setStockOpType('ASSIGN'); setSelectedStockProduct(p); setIsStockOpModalOpen(true); }} onScrap={(p) => { setStockOpType('SCRAP'); setSelectedStockProduct(p); setIsStockOpModalOpen(true); }} />}
                {currentView === 'employees' && <Employees employees={employees} assignments={assignments} onAddEmployee={handleAddEmployee} onReturnAsset={handleReturnAsset} />}
                {currentView === 'logs' && <Logs logs={stockLogs} />}
                {currentView === 'settings' && <Settings categories={categories} products={products} assignments={assignments} employees={employees} scrappedItems={scrappedItems} onAddCategory={handleAddCategory} onDeleteCategory={handleDeleteCategory} onImportData={() => {}} currentUser={currentUser} activeWarehouseId={activeWarehouseId} />}
              </>
            )}
            </div>
        </main>
      </div>

      <ProductModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} categories={categories} product={editingProduct} warehouseId={activeWarehouseId} />
      <StockOperationModal isOpen={isStockOpModalOpen} onClose={() => setIsStockOpModalOpen(false)} onSubmit={handleStockOperation} type={stockOpType} products={products} employees={employees} initialProduct={selectedStockProduct} />
    </div>
  );
};

export default App;
