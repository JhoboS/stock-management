
export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  created_at?: string;
}

export interface Product {
  id: string;
  warehouseId: string;
  name: string;
  nameZh: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  minStock: number;
  description: string;
  lastUpdated: string;
}

export interface Employee {
  id: string;
  warehouseId: string;
  name: string;
  email: string;
  department: string;
  role: string;
  joinedDate: string;
}

export interface InventoryStats {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  categories: { name: string; value: number }[];
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  restockPriority: string[];
}

export interface Assignment {
  id: string;
  warehouseId: string;
  productId: string;
  productName: string;
  productNameZh: string;
  employeeId: string;
  employeeName: string;
  quantity: number;
  assignedDate: string;
  status: 'Active' | 'Returned';
  performedBy: string;
}

export interface ScrappedItem {
  id: string;
  warehouseId: string;
  productId: string;
  productName: string;
  productNameZh: string;
  quantity: number;
  reason: string;
  scrappedDate: string;
  performedBy: string;
}

export interface StockLog {
  id: string;
  warehouseId: string;
  action: 'INBOUND' | 'UPDATE' | 'CREATE' | 'ASSIGN' | 'RETURN' | 'SCRAP';
  productName: string;
  quantity: number;
  performedBy: string;
  date: string;
  details?: string;
}

export interface AppUser {
  id: string;
  email: string;
  is_approved: boolean;
  role: 'admin' | 'super_admin' | 'user';
  assigned_warehouses: string[]; // Array of warehouse IDs
  created_at?: string;
}

export type OperationType = 'INBOUND' | 'ASSIGN' | 'SCRAP';
