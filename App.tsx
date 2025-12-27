
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
import { Loader2, AlertTriangle, Lock, Building2, ChevronDown, Check, Layout, ShieldCheck, Menu } from 'lucide-react';

const SUPER_ADMIN_EMAIL = 'jhobo@grnesl.com';
const DEFAULT_WH_ID = '00000000-0000-0000-0000-000000000000';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Super Admin Check
  const isSuperAdminUser = useMemo(() => session?.user?.email === SUPER_ADMIN_EMAIL, [session]);

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
        
        if (email === SUPER_ADMIN_EMAIL) {
          setIsApproved(true);
          const adminProfile: AppUser = {
            id: session.user.id,
            email: email,
            role: 'super_admin',
            is_approved: true,
            assigned_warehouses: []
          };
          setCurrentUser(adminProfile);
        }

        try {
          let allWh: Warehouse[] = [];
          try {
            allWh = await fetchWarehouses();
            setWarehouses(allWh);
          } catch (e: any) {
            if (isSuperAdminUser) setSchemaError("Database initialization required. Run SQL Repair in Settings.");
          }

          let appUser = await fetchAppUser(email);
          
          if (isSuperAdminUser) {
            if (!appUser || appUser.role !== 'super_admin') {
              try {
                const superAdminRecord: AppUser = { id: session.user.id, email, role: 'super_admin', is_approved: true, assigned_warehouses: [] };
                await createAppUser(superAdminRecord);
                appUser = superAdminRecord;
              } catch (e) {}
            }
          } else if (!appUser) {
            appUser = { id: session.user.id, email, role: 'user', is_approved: false, assigned_warehouses: [] };
            try { await createAppUser(appUser); } catch (e) {}
          }

          if (appUser) setCurrentUser(appUser);
          
          if (appUser?.is_approved || isSuperAdminUser) {
            setIsApproved(true);
            const usWh = allWh.find(w => w.id === DEFAULT_WH_ID);
            const initialWhId = usWh ? usWh.id : (appUser?.role === 'super_admin' ? allWh[0]?.id : appUser?.assigned_warehouses[0]);
            
            if (initialWhId) {
              setActiveWarehouseId(initialWhId);
            } else if (isSuperAdminUser) {
              setCurrentView('settings');
            }
          }
        } catch (error) {
          console.error("Initialization error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    checkUserAndLoad();
  }, [session, isSuperAdminUser]);

  useEffect(() => {
    if (activeWarehouseId && (isApproved || isSuperAdminUser)) {
        loadData();
    }
  }, [activeWarehouseId, isApproved, isSuperAdminUser]);

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
    } catch (error: any) {
        if (error.message?.includes('column') || error.message?.includes('relation')) {
            setSchemaError("Database Schema mismatch. Run SQL Repair in Settings.");
        }
    }
  };

  const handleSaveProduct = async (product: Product) => {
    try {
      const isNew = !products.find(p => p.id === product.id);
      await upsertProduct({ ...product, warehouseId: activeWarehouseId });
      await addStockLogApi({
        id: crypto.randomUUID(),
        warehouseId: activeWarehouseId,
        action: isNew ? 'CREATE' : 'UPDATE',
        productName: product.name,
        quantity: product.quantity,
        performedBy: session.user.email,
        date: new Date().toISOString(),
        details: isNew ? `Initial creation with ${product.quantity} units.` : 'Metadata or stock updated via editor.'
      });
      await loadData();
    } catch (error: any) { 
        alert(`Failed: ${error.message}`); 
    }
  };

  const handleStockOperation = async (data: any) => {
    const { productId, quantity, type, employeeId, employeeName, reason, productName, productNameZh } = data;
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const newQuantity = type === 'INBOUND' ? product.quantity + quantity : Math.max(0, product.quantity - quantity);
      await upsertProduct({ ...product, quantity: newQuantity, lastUpdated: new Date().toISOString() });

      if (type === 'ASSIGN') {
        await addAssignmentApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, productId, productName, productNameZh: productNameZh || '', employeeId, employeeName, quantity, assignedDate: new Date().toISOString(), status: 'Active', performedBy: session.user.email });
        await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'ASSIGN', productName, quantity, performedBy: session.user.email, date: new Date().toISOString(), details: `Assigned to ${employeeName}` });
      } else if (type === 'SCRAP') {
        await addScrappedItemApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, productId, productName, productNameZh: productNameZh || '', quantity, reason, scrappedDate: new Date().toISOString(), performedBy: session.user.email });
        await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'SCRAP', productName, quantity, performedBy: session.user.email, date: new Date().toISOString(), details: `Reason: ${reason}` });
      } else if (type === 'INBOUND') {
         await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'INBOUND', productName: product.name, quantity, performedBy: session.user.email, date: new Date().toISOString() });
      }
      await loadData();
    } catch (error: any) { alert(error.message); }
  };

  const handleReturnAsset = async (assignment: Assignment) => {
      try {
        const product = products.find(p => p.id === assignment.productId);
        if (product) await upsertProduct({ ...product, quantity: product.quantity + assignment.quantity, lastUpdated: new Date().toISOString() });
        await returnAssignmentApi(assignment.id);
        await addStockLogApi({ id: crypto.randomUUID(), warehouseId: activeWarehouseId, action: 'RETURN', productName: assignment.productName, quantity: assignment.quantity, performedBy: session.user.email, date: new Date().toISOString(), details: `Returned from ${assignment.employeeName}` });
        await loadData();
      } catch (error: any) { alert(error.message); }
  };

  const handleAddEmployee = async (newEmployee: Employee) => {
    try {
      await addEmployeeApi({ ...newEmployee, warehouseId: activeWarehouseId });
      await loadData();
    } catch (error: any) { alert(error.message); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (!session) return <Login />;
  if (isLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 className="animate-spin text-blue-600" size={48} /><p className="font-medium animate-pulse text-slate-600">Syncing System Ownership...</p></div>;

  if (!isApproved && !isSuperAdminUser) {
     return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-10 text-center animate-fade-in border border-slate-200">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={40} /></div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
                <p className="text-slate-500 mb-6 leading-relaxed">Your account requires approval from the system owner to access warehouse features.</p>
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-6 font-medium border border-slate-100">Contact: <span className="text-blue-600 font-bold">{SUPER_ADMIN_EMAIL}</span></div>
                <button onClick={handleLogout} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all">Sign Out</button>
            </div>
        </div>
     );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 flex-col">
      {schemaError && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg z-[150] sticky top-0 animate-fade-in">
          <div className="flex items-center gap-3 text-sm font-bold">
            <AlertTriangle size={20} className="animate-pulse" />
            <span className="truncate">{schemaError}</span>
          </div>
          <button onClick={() => { setCurrentView('settings'); setSchemaError(null); }} className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-black hover:bg-slate-100 transition-all ml-4 flex-shrink-0">Resolve</button>
        </div>
      )}

      {/* Mobile Top Nav */}
      <div className="md:hidden bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <Menu size={24} />
        </button>
        <span className="font-black tracking-tight text-sm uppercase">Great River</span>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black">
          {session.user.email?.substring(0,1).toUpperCase()}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView} 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
        
        {/* Dynamic margin based on responsive breakpoint */}
        <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen bg-slate-50/50 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
            <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 capitalize tracking-tight">{currentView}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Region</span>
                    <div className="relative">
                        <button onClick={() => setIsWhMenuOpen(!isWhMenuOpen)} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-blue-600 shadow-sm hover:border-blue-300 transition-all">
                            <Building2 size={12} className="opacity-70" /> 
                            {activeWarehouse?.name || (isSuperAdminUser ? 'Setup' : '...')} 
                            <ChevronDown size={12} className={`transition-transform ${isWhMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isWhMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 md:w-64 bg-white border rounded-2xl shadow-2xl z-[110] overflow-hidden py-2 animate-fade-in">
                                {userWarehouses.map(wh => (
                                    <button key={wh.id} onClick={() => { setActiveWarehouseId(wh.id); setIsWhMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-blue-50 ${activeWarehouseId === wh.id ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'}`}>
                                        <span className="flex items-center gap-3 truncate text-xs"><Building2 size={14} className="opacity-40" /> {wh.name}</span>
                                        {activeWarehouseId === wh.id && <Check size={16} strokeWidth={3} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                  </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{session.user.email}</p>
                    <div className="flex items-center gap-2 justify-end mt-0.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${isSuperAdminUser ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{isSuperAdminUser ? 'Owner' : 'Staff'}</span>
                      <button onClick={handleLogout} className="text-[9px] text-red-500 font-black uppercase hover:underline">Exit</button>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-xl ring-4 ring-white select-none">
                    {isSuperAdminUser ? <ShieldCheck size={24} /> : session.user.email?.substring(0,1).toUpperCase()}
                  </div>
                </div>
            </header>

            {!activeWarehouseId && isSuperAdminUser && currentView !== 'settings' ? (
               <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-16 text-center animate-slide-up shadow-sm">
                  <Building2 size={48} className="mx-auto text-blue-100 mb-4" />
                  <h3 className="text-xl font-black text-slate-900 mb-2">Initialization Required</h3>
                  <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm">Welcome! Please setup your first regional warehouse to begin.</p>
                  <button onClick={() => setCurrentView('settings')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all mx-auto">
                    Setup System
                  </button>
               </div>
            ) : (
              <div className="pb-10">
                {currentView === 'dashboard' && <Dashboard products={products} />}
                {currentView === 'inventory' && <Inventory products={products} categories={categories} assignments={assignments} scrappedItems={scrappedItems} logs={stockLogs} onAddProduct={() => { setEditingProduct(undefined); setIsProductModalOpen(true); }} onEditProduct={(p) => { setEditingProduct(p); setIsProductModalOpen(true); }} onDeleteProduct={deleteProductApi} onInbound={() => { setStockOpType('INBOUND'); setSelectedStockProduct(undefined); setIsStockOpModalOpen(true); }} onAssign={(p) => { setStockOpType('ASSIGN'); setSelectedStockProduct(p); setIsStockOpModalOpen(true); }} onScrap={(p) => { setStockOpType('SCRAP'); setSelectedStockProduct(p); setIsStockOpModalOpen(true); }} />}
                {currentView === 'employees' && <Employees employees={employees} assignments={assignments} onAddEmployee={handleAddEmployee} onReturnAsset={handleReturnAsset} />}
                {currentView === 'logs' && <Logs logs={stockLogs} />}
                {currentView === 'settings' && <Settings categories={categories} products={products} assignments={assignments} employees={employees} scrappedItems={scrappedItems} onAddCategory={async (c) => {
                    try {
                        await addCategoryApi(c, activeWarehouseId);
                        await loadData();
                    } catch (err: any) {
                        alert(`Error: ${err.message}`);
                    }
                }} onDeleteCategory={async (c) => {
                    const productCount = products.filter(p => p.category === c).length;
                    if (productCount > 0) {
                      alert(`Error: ${productCount} products still in this category.`);
                      return;
                    }
                    try {
                      await deleteCategoryApi(c, activeWarehouseId);
                      await loadData();
                    } catch (err: any) {
                      alert(`Failed: ${err.message}`);
                    }
                }} onImportData={() => {}} currentUser={currentUser} activeWarehouseId={activeWarehouseId} />}
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
