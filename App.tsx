
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import ProductModal from './components/ProductModal';
import StockOperationModal from './components/StockOperationModal';
import Scrapped from './components/Scrapped';
import Employees from './components/Employees';
import Settings from './components/Settings';
import Login from './components/Login';
import Logs from './components/Logs'; // New Component
import { 
  fetchProducts, upsertProduct, deleteProductApi,
  fetchAssignments, addAssignmentApi,
  fetchScrappedItems, addScrappedItemApi,
  fetchEmployees, addEmployeeApi,
  fetchCategories, addCategoryApi, deleteCategoryApi,
  fetchAppUser, createAppUser, addStockLogApi, fetchStockLogs
} from './services/storageService';
import { supabase, isConfigured } from './services/supabaseClient';
import { Product, Assignment, ScrappedItem, OperationType, Employee, AppUser, StockLog } from './types';
import { Loader2, Database, AlertTriangle, Lock } from 'lucide-react';

const SUPER_ADMIN_EMAIL = 'jhobo@grnesl.com';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  // Data State
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scrappedItems, setScrappedItems] = useState<ScrappedItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  
  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  
  const [isStockOpModalOpen, setIsStockOpModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<OperationType>('INBOUND');
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | undefined>(undefined);

  // Auth Check
  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // User Profile & Data Loading
  useEffect(() => {
    const checkUserAndLoad = async () => {
      if (session && isConfigured) {
        setIsLoading(true);
        const email = session.user.email;
        
        try {
          // 1. Check Super Admin hardcode
          if (email === SUPER_ADMIN_EMAIL) {
            // Ensure Super Admin exists in DB (so they appear in User Management lists)
            // Wrap in try/catch so we don't block login if tables are missing
            try {
                const existingAdmin = await fetchAppUser(email);
                if (!existingAdmin) {
                    await createAppUser({
                        id: session.user.id,
                        email,
                        role: 'super_admin',
                        is_approved: true
                    });
                }
            } catch (e) {
                console.warn("Could not sync admin to DB (tables might be missing)", e);
            }

            setIsApproved(true);
            setCurrentUser({ id: session.user.id, email, role: 'super_admin', is_approved: true });
            await loadData();
          } else {
            // 2. Check App Users table
            let appUser = await fetchAppUser(email);
            
            if (!appUser) {
              // Create pending user if not exists
              appUser = {
                id: session.user.id,
                email,
                role: 'user',
                is_approved: false
              };
              await createAppUser(appUser);
            }

            setCurrentUser(appUser);
            if (appUser.is_approved) {
              setIsApproved(true);
              await loadData();
            } else {
              setIsApproved(false);
            }
          }
        } catch (error) {
          console.error("Auth flow error", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    checkUserAndLoad();
  }, [session]);

  const loadData = async () => {
    try {
      const [prod, assign, scrap, emp, cats, logs] = await Promise.all([
        fetchProducts(),
        fetchAssignments(),
        fetchScrappedItems(),
        fetchEmployees(),
        fetchCategories(),
        fetchStockLogs()
      ]);
      setProducts(prod);
      setAssignments(assign);
      setScrappedItems(scrap);
      setEmployees(emp);
      setCategories(cats);
      setStockLogs(logs);
    } catch (error) {
      console.error("Failed to load data", error);
      // Don't alert blocking error, might just be empty tables
    }
  };

  const handleSaveProduct = async (product: Product) => {
    try {
      const isNew = !products.find(p => p.id === product.id);
      // Optimistic update
      let updatedProducts;
      if (editingProduct) {
        updatedProducts = products.map(p => p.id === product.id ? product : p);
      } else {
        updatedProducts = [...products, product];
      }
      setProducts(updatedProducts);
      
      await upsertProduct(product);
      
      // Log creation
      if (isNew) {
        const log: StockLog = {
          id: crypto.randomUUID(),
          action: 'CREATE',
          productName: product.name,
          quantity: product.quantity,
          performedBy: session.user.email,
          date: new Date().toISOString()
        };
        await addStockLogApi(log);
        setStockLogs([log, ...stockLogs]);
      } else {
         // Optionally log updates, but might be too noisy. We focus on Inbound/Stock ops.
      }

      // Reload to ensure sync
      const refreshed = await fetchProducts();
      setProducts(refreshed);
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Unknown error";
      if (msg.includes('column') || msg.includes('relation')) {
          alert("DATABASE SCHEMA ERROR: Missing columns. \n\nPlease go to Settings > View Database Schema, copy the SQL, and run it in Supabase SQL Editor to fix your tables.");
      } else {
          alert(`Failed to save product: ${msg}`);
      }
      loadData(); // Revert on error
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const updatedProducts = products.filter(p => p.id !== id);
        setProducts(updatedProducts);
        await deleteProductApi(id);
      } catch (error) {
        alert("Failed to delete product");
        loadData();
      }
    }
  };

  const handleStockOperation = async (data: any) => {
    const { productId, quantity, type, employeeId, employeeName, reason, productName, productNameZh } = data;
    const userEmail = session.user.email;
    
    try {
      // 1. Update Product Stock
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const newQuantity = type === 'INBOUND' ? product.quantity + quantity : Math.max(0, product.quantity - quantity);
      const updatedProduct = { ...product, quantity: newQuantity, lastUpdated: new Date().toISOString() };
      
      // Optimistic Update
      setProducts(products.map(p => p.id === productId ? updatedProduct : p));
      await upsertProduct(updatedProduct);

      // 2. Create Transaction Record
      if (type === 'ASSIGN') {
        const newAssignment: Assignment = {
          id: crypto.randomUUID(),
          productId,
          productName,
          productNameZh: productNameZh || '',
          employeeId,
          employeeName,
          quantity,
          assignedDate: new Date().toISOString(),
          status: 'Active',
          performedBy: userEmail
        };
        setAssignments([...assignments, newAssignment]);
        await addAssignmentApi(newAssignment);
      } else if (type === 'SCRAP') {
        const newScrap: ScrappedItem = {
          id: crypto.randomUUID(),
          productId,
          productName,
          productNameZh: productNameZh || '',
          quantity,
          reason,
          scrappedDate: new Date().toISOString(),
          performedBy: userEmail
        };
        setScrappedItems([newScrap, ...scrappedItems]);
        await addScrappedItemApi(newScrap);
      } else if (type === 'INBOUND') {
         // Log Inbound
         const log: StockLog = {
             id: crypto.randomUUID(),
             action: 'INBOUND',
             productName: product.name,
             quantity: quantity,
             performedBy: userEmail,
             date: new Date().toISOString()
         };
         setStockLogs([log, ...stockLogs]);
         await addStockLogApi(log);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Unknown error";
      if (msg.includes('column') || msg.includes('relation')) {
          alert("DATABASE SCHEMA ERROR: Missing columns. \n\nPlease go to Settings > View Database Schema, copy the SQL, and run it in Supabase SQL Editor to fix your tables.");
      } else {
          alert(`Operation failed: ${msg}`);
      }
      loadData();
    }
  };

  const handleAddEmployee = async (newEmployee: Employee) => {
    try {
      setEmployees([...employees, newEmployee]);
      await addEmployeeApi(newEmployee);
    } catch (error) {
      alert("Failed to add employee");
      loadData();
    }
  };

  const handleAddCategory = async (cat: string) => {
      if (!categories.includes(cat)) {
          try {
            setCategories([...categories, cat]);
            await addCategoryApi(cat);
          } catch (e) {
            alert("Failed to add category");
            loadData();
          }
      }
  };

  const handleDeleteCategory = async (cat: string) => {
      try {
        const updatedCategories = categories.filter(c => c !== cat);
        setCategories(updatedCategories);
        await deleteCategoryApi(cat);
      } catch (e) {
        alert("Failed to delete category");
        loadData();
      }
  };

  const handleImportData = async (data: any) => {
    alert("Bulk import is not fully supported in Cloud Mode yet to prevent data conflicts. Please add items manually.");
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Modal Triggers
  const openAddModal = () => {
    setEditingProduct(undefined);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const openStockOpModal = (type: OperationType, product?: Product) => {
    setStockOpType(type);
    setSelectedStockProduct(product);
    setIsStockOpModalOpen(true);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard products={products} />;
      case 'inventory':
        return (
          <Inventory 
            products={products} 
            categories={categories}
            onAddProduct={openAddModal}
            onEditProduct={openEditModal}
            onDeleteProduct={handleDeleteProduct}
            onInbound={() => openStockOpModal('INBOUND')}
            onAssign={(p) => openStockOpModal('ASSIGN', p)}
            onScrap={(p) => openStockOpModal('SCRAP', p)}
          />
        );
      case 'employees':
        return <Employees employees={employees} assignments={assignments} onAddEmployee={handleAddEmployee} />;
      case 'scrapped':
        return <Scrapped scrappedItems={scrappedItems} />;
      case 'logs':
        return <Logs logs={stockLogs} />;
      case 'settings':
        return (
          <Settings 
            categories={categories} 
            products={products} 
            assignments={assignments}
            employees={employees}
            scrappedItems={scrappedItems}
            onAddCategory={handleAddCategory} 
            onDeleteCategory={handleDeleteCategory} 
            onImportData={handleImportData}
            currentUser={currentUser}
          />
        );
      default:
        return <Dashboard products={products} />;
    }
  };

  // 1. Missing Configuration State
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-8 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Database size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Connect to Database</h1>
            <p className="text-slate-500">
              To use the cloud storage features, you must connect your Supabase database.
            </p>
          </div>
          
          <div className="bg-slate-100 p-4 rounded-lg text-left text-sm space-y-3 font-mono text-slate-700">
            <div className="flex items-center gap-2 text-amber-600 font-sans font-bold text-xs uppercase tracking-wider mb-1">
              <AlertTriangle size={12} />
              Missing Environment Variables
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">Project URL</p>
              <div className="bg-white p-2 rounded border border-slate-200 break-all">
                SUPABASE_URL
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">Public Anon Key</p>
              <div className="bg-white p-2 rounded border border-slate-200 break-all">
                SUPABASE_ANON_KEY
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Auth State
  if (!session) {
    return <Login />;
  }

  // 3. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="font-medium animate-pulse">Syncing with Great River Database...</p>
      </div>
    );
  }

  // 4. Not Approved State
  if (!isApproved) {
     return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in text-center p-10">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock size={40} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Pending Approval</h1>
                <p className="text-slate-500 mb-6">
                    Your account ({session.user.email}) has been created but requires approval from an administrator.
                </p>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 mb-6">
                    Please contact <strong>jhobo@grnesl.com</strong> to activate your access.
                </div>
                <button onClick={handleLogout} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                    Sign Out and Check Later
                </button>
            </div>
        </div>
     );
  }

  // 5. Main App State
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 capitalize">
                {currentView === 'scrapped' ? 'Scrap Log' : 
                 currentView === 'employees' ? 'Staff Management' :
                 currentView === 'logs' ? 'Operation History' :
                 currentView === 'settings' ? 'System Settings' : currentView}
              </h2>
              <p className="text-slate-500">
                {currentView === 'dashboard' && `Overview of ${products.length} products`}
                {currentView === 'inventory' && 'Manage your stock catalogue'}
                {currentView === 'employees' && 'Manage staff and track asset assignments'}
                {currentView === 'scrapped' && 'View history of damaged or lost items'}
                {currentView === 'logs' && 'View inbound history and system logs'}
                {currentView === 'settings' && 'Configure system preferences and users'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{session.user.email}</p>
                <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-medium">Sign Out</button>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                {session.user.email?.substring(0,2).toUpperCase()}
              </div>
            </div>
          </header>

          {renderContent()}
        </div>
      </main>

      <ProductModal 
        isOpen={isProductModalOpen} 
        onClose={() => setIsProductModalOpen(false)} 
        onSave={handleSaveProduct}
        categories={categories}
        product={editingProduct}
      />

      <StockOperationModal
        isOpen={isStockOpModalOpen}
        onClose={() => setIsStockOpModalOpen(false)}
        onSubmit={handleStockOperation}
        type={stockOpType}
        products={products}
        employees={employees}
        initialProduct={selectedStockProduct}
      />
    </div>
  );
};

export default App;
