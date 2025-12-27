
import { supabase } from './supabaseClient';
import { Product, Assignment, ScrappedItem, Employee, AppUser, StockLog, Warehouse } from '../types';

// Warehouses
export const fetchWarehouses = async (): Promise<Warehouse[]> => {
  const { data, error } = await supabase.from('warehouses').select('*').order('name');
  if (error) throw error;
  return data || [];
};

export const createWarehouseApi = async (name: string, location?: string): Promise<Warehouse> => {
  const { data, error } = await supabase.from('warehouses').insert({ name, location }).select().single();
  if (error) throw error;
  return data;
};

// Products
export const fetchProducts = async (warehouseId: string): Promise<Product[]> => {
  const { data, error } = await supabase.from('products').select('*').eq('warehouse_id', warehouseId);
  if (error) throw error;
  
  return (data || []).map((p: any) => ({
    id: p.id,
    warehouseId: p.warehouse_id,
    name: p.name || 'Unnamed Asset',
    nameZh: p.name_zh || '', 
    sku: p.sku || 'N/A',
    category: p.category || 'Uncategorized',
    quantity: p.quantity || 0,
    price: p.price || 0,
    minStock: p.min_stock || 0,
    description: p.description || '',
    lastUpdated: p.last_updated || new Date().toISOString()
  }));
};

export const upsertProduct = async (product: Product): Promise<void> => {
  const dbRecord = {
    id: product.id,
    warehouse_id: product.warehouseId,
    name: product.name,
    name_zh: product.nameZh,
    sku: product.sku,
    category: product.category,
    quantity: product.quantity,
    price: product.price,
    min_stock: product.minStock,
    description: product.description,
    last_updated: product.lastUpdated
  };

  const { error } = await supabase.from('products').upsert(dbRecord);
  if (error) throw error;
};

// Employees
export const fetchEmployees = async (warehouseId: string): Promise<Employee[]> => {
  const { data, error } = await supabase.from('employees').select('*').eq('warehouse_id', warehouseId);
  if (error) throw error;
  
  return (data || []).map((e: any) => ({
    id: e.id,
    warehouseId: e.warehouse_id,
    name: e.name || 'Unknown Staff',
    email: e.email || '',
    department: e.department || 'General',
    role: e.role || 'Staff',
    joinedDate: e.joined_date || e.created_at || new Date().toISOString()
  }));
};

export const addEmployeeApi = async (employee: Employee): Promise<void> => {
  const dbRecord = {
    id: employee.id,
    warehouse_id: employee.warehouseId,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    role: employee.role,
    joined_date: employee.joinedDate
  };
  const { error } = await supabase.from('employees').insert(dbRecord);
  if (error) throw error;
};

// Assignments
export const fetchAssignments = async (warehouseId: string): Promise<Assignment[]> => {
  const { data, error } = await supabase.from('assignments').select('*').eq('warehouse_id', warehouseId);
  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    id: item.id,
    warehouseId: item.warehouse_id,
    productId: item.product_id,
    productName: item.product_name || 'Deleted Product',
    productNameZh: item.product_name_zh || '',
    employeeId: item.employee_id,
    employeeName: item.employee_name || 'Unknown Employee',
    quantity: item.quantity || 0,
    assignedDate: item.assigned_date || item.created_at || new Date().toISOString(),
    status: item.status || 'Active',
    performedBy: item.performed_by || 'System'
  }));
};

export const addAssignmentApi = async (assignment: Assignment): Promise<void> => {
  const dbRecord = {
    id: assignment.id,
    warehouse_id: assignment.warehouseId,
    product_id: assignment.productId,
    product_name: assignment.productName,
    product_name_zh: assignment.productNameZh,
    employee_id: assignment.employeeId,
    employee_name: assignment.employeeName,
    quantity: assignment.quantity,
    assigned_date: assignment.assignedDate,
    status: assignment.status,
    performed_by: assignment.performedBy
  };
  const { error } = await supabase.from('assignments').insert(dbRecord);
  if (error) throw error;
};

// Scrapped Items
export const fetchScrappedItems = async (warehouseId: string): Promise<ScrappedItem[]> => {
  const { data, error } = await supabase.from('scrapped_items').select('*').eq('warehouse_id', warehouseId);
  if (error) throw error;
  return (data || []).map((item: any) => ({
    id: item.id,
    warehouseId: item.warehouse_id,
    productId: item.product_id,
    productName: item.product_name || 'Deleted Product',
    productNameZh: item.product_name_zh || '',
    quantity: item.quantity || 0,
    reason: item.reason || 'No reason provided',
    scrappedDate: item.scrapped_date || item.created_at || new Date().toISOString(),
    performedBy: item.performed_by || 'System'
  }));
};

export const addScrappedItemApi = async (item: ScrappedItem): Promise<void> => {
  const dbRecord = {
    id: item.id,
    warehouse_id: item.warehouseId,
    product_id: item.productId,
    // Fix: access item properties using camelCase as defined in types.ts
    product_name: item.productName,
    product_name_zh: item.productNameZh,
    quantity: item.quantity,
    reason: item.reason,
    scrapped_date: item.scrappedDate,
    performed_by: item.performedBy
  };
  const { error } = await supabase.from('scrapped_items').insert(dbRecord);
  if (error) throw error;
};

// Categories
export const fetchCategories = async (warehouseId: string): Promise<string[]> => {
  const { data, error } = await supabase.from('categories').select('name').eq('warehouse_id', warehouseId);
  if (error) throw error;
  return data ? data.map((c: any) => c.name) : [];
};

export const addCategoryApi = async (name: string, warehouseId: string): Promise<void> => {
  const { error } = await supabase.from('categories').insert({ name, warehouse_id: warehouseId });
  if (error) throw error;
};

export const deleteCategoryApi = async (name: string, warehouseId: string): Promise<void> => {
  const { error } = await supabase.from('categories').delete().match({ name, warehouse_id: warehouseId });
  if (error) throw error;
};

// Stock Logs
export const fetchStockLogs = async (warehouseId: string): Promise<StockLog[]> => {
  try {
    const { data, error } = await supabase
      .from('stock_logs')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('date', { ascending: false });
      
    if (error) {
      console.error("Supabase error fetching logs:", error);
      return [];
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      warehouseId: item.warehouse_id,
      action: item.action || 'UPDATE',
      productName: item.product_name || 'Unknown Item',
      quantity: item.quantity || 0,
      performedBy: item.performed_by || 'System User',
      date: item.date || item.created_at || new Date().toISOString(),
      details: item.details || ''
    }));
  } catch (err) {
    console.error("Failed to map stock logs:", err);
    return [];
  }
};

export const addStockLogApi = async (log: StockLog): Promise<void> => {
  const dbRecord = {
    id: log.id,
    warehouse_id: log.warehouseId,
    action: log.action,
    product_name: log.productName,
    quantity: log.quantity,
    performed_by: log.performedBy,
    date: log.date,
    details: log.details
  };
  await supabase.from('stock_logs').insert(dbRecord);
};

// User Management
export const fetchAppUser = async (email: string): Promise<AppUser | null> => {
  const { data, error } = await supabase.from('app_users').select('*').eq('email', email).maybeSingle();
  if (error) return null;
  return data ? {
    ...data,
    assigned_warehouses: data.assigned_warehouses || []
  } : null;
};

export const createAppUser = async (user: AppUser): Promise<void> => {
  const { error } = await supabase.from('app_users').insert(user);
  if (error) throw error;
};

export const fetchAllUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(u => ({
    ...u,
    assigned_warehouses: u.assigned_warehouses || []
  }));
};

export const updateUserStatus = async (email: string, isApproved: boolean): Promise<void> => {
  const { error } = await supabase.from('app_users').update({ is_approved: isApproved }).eq('email', email);
  if (error) throw error;
};

export const updateUserWarehouses = async (email: string, warehouseIds: string[]): Promise<void> => {
  const { error } = await supabase.from('app_users').update({ assigned_warehouses: warehouseIds }).eq('email', email);
  if (error) throw error;
};

export const deleteProductApi = async (id: string): Promise<void> => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

export const returnAssignmentApi = async (assignmentId: string): Promise<void> => {
  const { error } = await supabase.from('assignments').update({ status: 'Returned' }).eq('id', assignmentId);
  if (error) throw error;
};
