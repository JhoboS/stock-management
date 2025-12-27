
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
import { Loader2, Database, AlertTriangle, Lock, XCircle, Building2, ChevronDown, Check, Layout, ShieldCheck } from 'lucide-react';

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
  
  // Super Admin Check
  const isSuperAdminUser = useMemo(() => session?.user?.email === SUPER_ADMIN_EMAIL, [session]);

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
          // Attempt to fetch warehouses, but don't let it crash the whole app if table doesn't exist
          let allWh: Warehouse[] = [];
          try {
            allWh = await fetchWarehouses();
            setWarehouses(allWh);
          } catch (e: any) {
            console.warn("Warehouse table might not exist yet:", e.message);
            if (isSuperAdminUser) setSchemaError("Database Tables Missing. Please go to Settings and run SQL Repair.");
          }

          let appUser = await fetchAppUser(email);
          
          // CRITICAL: Self-healing and implicit approval for Super Admin
          if (isSuperAdminUser) {
            const superAdminUser: AppUser = { 
              id: session.user.id, 
              email, 
              role: 'super_admin', 
              is_approved: true, 
              assigned_warehouses: appUser?.assigned_warehouses || [] 
            };
            
            // Sync with DB if missing or outdated role
            if (!appUser || appUser.role !== 'super_admin' || !appUser.is_approved) {
              try {
                await createAppUser(superAdminUser);
              } catch (dbError) {
                console.error("Failed to sync super admin to DB, but proceeding in-memory:", dbError);
              }
            }
            appUser = superAdminUser;
          } else if (!appUser) {
            appUser = { id: session.user.id, email, role: 'user', is_approved: false, assigned_warehouses: [] };
            try {
              await createAppUser(appUser);
            } catch (e) {}
          }

          setCurrentUser(appUser);
          
          // Super admin is ALWAYS approved
          if (appUser.is_approved || isSuperAdminUser) {
            setIsApproved(true);
            
            // Set first warehouse if available
            const initialWhId = appUser.role === 'super_admin' ? allWh[0]?.id : appUser.assigned_warehouses[0];
            if (initialWhId) {
              setActiveWarehouseId(initialWhId);
            } else if (isSuperAdminUser) {
              // Redirect super admin to settings if no warehouses exist
              setCurrentView('settings');
            }
          }
        } catch (error) { 
          console.error("App initialization failed:", error);
        } finally { 
          setIsLoading(false); 
        }
      }
    };
    checkUserAndLoad();
  }, [session, isSuperAdminUser]);

  // Re-fetch data whenever the warehouse changes
  useEffect(() => {
    if (activeWarehouseId && (isApproved || isSuperAdminUser)) {
        loadData();
    }
  }, [activeWarehouseId, isApproved, isSuperAdminUser]);

  const handleError = (error: any) => {
    const msg = error.message || "Unknown error";
    if (msg.includes('column') || msg.includes('relation') || msg.includes('does not exist')) {
        setSchemaError("Database Schema Mismatch: Missing required columns or tables. Go to Settings > SQL Repair.");
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
  
  if (isLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="animate-spin text-blue-600" size={48} /><p className="font-medium animate-pulse text-slate-600">Initializing Secure Session...</p></div>;

  // BYPASS: If isSuperAdminUser is true, we ignore the !isApproved flag
  if (!isApproved && !isSuperAdminUser) {
     return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-10 text-center animate-fade-in border border-slate-200">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={40} /></div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
                <p className="text-slate-500 mb-6 leading-relaxed">Your account is registered but requires approval from the system owner to access the warehouse management features.</p>
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-6 font-medium border border-slate-100">
                  Contact System Owner: <span className="text-blue-600 font-bold">{SUPER_ADMIN_EMAIL}</span>
                </div>
                <button onClick={handleLogout} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">Sign Out</button>
            </div>
        </div>
     );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 relative flex-col">
      {schemaError && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg z-[100] sticky top-0 animate-fade-in">
          <div className="flex items-center gap-3 text-sm font-bold">
            <AlertTriangle size={20} className="animate-pulse" />
            <span>{schemaError}</span>
          </div>
          <button 
            onClick={() => { setCurrentView('settings'); setSchemaError(null); }} 
            className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-colors shadow-sm"
          >
            Fix Database Now
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen bg-slate-50/50">
            <div className="max-w-7xl mx-auto">
            <header className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight">{currentView}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Active Context</span>
                    <div className="relative">
                        <button onClick={() => setIsWhMenuOpen(!isWhMenuOpen)} className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
                            <Building2 size={14} className="opacity-70" /> 
                            {activeWarehouse?.name || (isSuperAdminUser ? 'Setup Required' : 'Selecting...')} 
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isWhMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isWhMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[110] overflow-hidden py-2 animate-fade-in ring-1 ring-black/5">
                                <div className="px-4 py-2 text-[9px] uppercase font-black text-slate-400 tracking-tighter border-b border-slate-100 mb-1">Region Selection</div>
                                {userWarehouses.map(wh => (
                                    <button 
                                        key={wh.id} 
                                        onClick={() => { setActiveWarehouseId(wh.id); setIsWhMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-blue-50/50 transition-colors group ${activeWarehouseId === wh.id ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'}`}
                                    >
                                        <span className="flex items-center gap-3 truncate">
                                          <Building2 size={14} className={`transition-opacity ${activeWarehouseId === wh.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`} /> 
                                          {wh.name}
                                        </span>
                                        {activeWarehouseId === wh.id && <Check size={16} strokeWidth={3} />}
                                    </button>
                                ))}
                                {userWarehouses.length === 0 && (
                                  <div className="p-5 text-center">
                                    <p className="text-xs text-slate-400 italic mb-3">No regional warehouses discovered.</p>
                                    {isSuperAdminUser && (
                                      <button onClick={() => { setCurrentView('settings'); setIsWhMenuOpen(false); }} className="w-full bg-blue-600 text-white text-[10px] font-black uppercase py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                                        Initialize Warehouse
                                      </button>
                                    )}
                                  </div>
                                )}
                            </div>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-slate-900">{session.user.email}</p>
                    <div className="flex items-center gap-2 justify-end mt-0.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${isSuperAdminUser ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {isSuperAdminUser ? 'System Owner' : currentUser?.role.replace('_', ' ')}
                      </span>
                      <button onClick={handleLogout} className="text-[9px] text-red-500 font-black uppercase hover:text-red-700 transition-colors">Sign Out</button>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-xl shadow-blue-500/20 ring-4 ring-white select-none">
                    {isSuperAdminUser ? <ShieldCheck size={24} /> : session.user.email?.substring(0,1).toUpperCase()}
                  </div>
                </div>
            </header>

            {!activeWarehouseId && isSuperAdminUser && currentView !== 'settings' ? (
               <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center animate-slide-up shadow-sm">
                  <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <Building2 size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Setup Required</h3>
                  <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed">Welcome, System Owner. To begin managing stock, you must first define at least one regional warehouse in the system settings.</p>
                  <button onClick={() => setCurrentView('settings')} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 shadow-2xl shadow-slate-900/20 transition-all flex items-center gap-3 mx-auto active:scale-95">
                    <Layout size={18} />
                    Open Configuration
                  </button>
               </div>
            ) : (
              <div className="pb-10">
                {currentView === 'dashboard' && <Dashboard products={products} />}
                {currentView === 'inventory' && <Inventory products={products} categories={categories} assignments={assignments} scrappedItems={scrappedItems} logs={stockLogs} onAddProduct={() => { setEditingProduct(undefined); setIsProductModalOpen(true); }} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true); }} onDeleteProduct={deleteProductApi} onInbound={() => { setStockOpType('INBOUND'); setSelectedStockProduct(undefined); setIsStockOpModalOpen(true); }} onAssign={(p) => { setStockOpType('ASSIGN'); setSelectedStockProduct(p); setIsStockOpModalOpen(true); }} onScrap={(p) => { setStockOpType('SCRAP'); setSelectedStockProduct(p); setIsStockOpModalOpen(true); }} />}
                {currentView === 'employees' && <Employees employees={employees} assignments={assignments} onAddEmployee={handleAddEmployee} onReturnAsset={handleReturnAsset} />}
                {currentView === 'logs' && <Logs logs={stockLogs} />}
                {currentView === 'settings' && <Settings categories={categories} products={products} assignments={assignments} employees={employees} scrappedItems={scrappedItems} onAddCategory={handleAddCategory} onDeleteCategory={handleDeleteCategory} onImportData={() => {}} currentUser={currentUser} activeWarehouseId={activeWarehouseId} />}
              </div>
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
