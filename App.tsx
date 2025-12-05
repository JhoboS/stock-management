import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import ProductModal from './components/ProductModal';
import StockOperationModal from './components/StockOperationModal';
import Scrapped from './components/Scrapped';
import Employees from './components/Employees';
import Settings from './components/Settings';
import { 
  getInventory, saveInventory, 
  getAssignments, saveAssignments,
  getScrappedItems, saveScrappedItems,
  getEmployees, saveEmployees,
  getCategories, saveCategories
} from './services/storageService';
import { Product, Assignment, ScrappedItem, OperationType, Employee } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scrappedItems, setScrappedItems] = useState<ScrappedItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  
  const [isStockOpModalOpen, setIsStockOpModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<OperationType>('INBOUND');
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | undefined>(undefined);

  useEffect(() => {
    // Load initial data
    setProducts(getInventory());
    setAssignments(getAssignments());
    setScrappedItems(getScrappedItems());
    setEmployees(getEmployees());
    setCategories(getCategories());
  }, []);

  const handleSaveProduct = (product: Product) => {
    let updatedProducts;
    if (editingProduct) {
      updatedProducts = products.map(p => p.id === product.id ? product : p);
    } else {
      updatedProducts = [...products, product];
    }
    setProducts(updatedProducts);
    saveInventory(updatedProducts);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      const updatedProducts = products.filter(p => p.id !== id);
      setProducts(updatedProducts);
      saveInventory(updatedProducts);
    }
  };

  const handleStockOperation = (data: any) => {
    const { productId, quantity, type, employeeId, employeeName, reason, productName, productNameZh } = data;
    
    // Update Product Stock
    const updatedProducts = products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          quantity: type === 'INBOUND' ? p.quantity + quantity : Math.max(0, p.quantity - quantity),
          lastUpdated: new Date().toISOString()
        };
      }
      return p;
    });
    setProducts(updatedProducts);
    saveInventory(updatedProducts);

    // Handle Specific Records
    if (type === 'ASSIGN') {
      const newAssignment: Assignment = {
        id: Date.now().toString(),
        productId,
        productName,
        productNameZh: productNameZh || '',
        employeeId,
        employeeName,
        quantity,
        assignedDate: new Date().toISOString(),
        status: 'Active'
      };
      const updatedAssignments = [...assignments, newAssignment];
      setAssignments(updatedAssignments);
      saveAssignments(updatedAssignments);
    } else if (type === 'SCRAP') {
      const newScrap: ScrappedItem = {
        id: Date.now().toString(),
        productId,
        productName,
        productNameZh: productNameZh || '',
        quantity,
        reason,
        scrappedDate: new Date().toISOString()
      };
      const updatedScrapped = [newScrap, ...scrappedItems];
      setScrappedItems(updatedScrapped);
      saveScrappedItems(updatedScrapped);
    }
  };

  const handleAddEmployee = (newEmployee: Employee) => {
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      saveEmployees(updatedEmployees);
  };

  const handleAddCategory = (cat: string) => {
      if (!categories.includes(cat)) {
          const updatedCategories = [...categories, cat];
          setCategories(updatedCategories);
          saveCategories(updatedCategories);
      }
  };

  const handleDeleteCategory = (cat: string) => {
      const updatedCategories = categories.filter(c => c !== cat);
      setCategories(updatedCategories);
      saveCategories(updatedCategories);
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
      case 'settings':
        return <Settings categories={categories} products={products} onAddCategory={handleAddCategory} onDeleteCategory={handleDeleteCategory} />;
      default:
        return <Dashboard products={products} />;
    }
  };

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
                 currentView === 'settings' ? 'System Settings' : currentView}
              </h2>
              <p className="text-slate-500">
                {currentView === 'dashboard' && `Overview of ${products.length} products`}
                {currentView === 'inventory' && 'Manage your stock catalogue'}
                {currentView === 'employees' && 'Manage staff and track asset assignments'}
                {currentView === 'scrapped' && 'View history of damaged or lost items'}
                {currentView === 'settings' && 'Configure system preferences and AI Advisor'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">Admin User</p>
                <p className="text-xs text-slate-500">admin@greatriver.com</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                AU
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