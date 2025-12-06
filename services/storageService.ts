
import { supabase } from './supabaseClient';
import { Product, Assignment, ScrappedItem, Employee, AppUser, StockLog } from '../types';

// Products
export const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase.from('products').select('*');
  if (error) throw error;
  
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    nameZh: p.name_zh || p.nameZh || '', 
    sku: p.sku,
    category: p.category,
    quantity: p.quantity,
    price: p.price,
    minStock: p.min_stock !== undefined ? p.min_stock : (p.minStock || 0),
    description: p.description,
    lastUpdated: p.last_updated || p.lastUpdated || p.created_at || new Date().toISOString()
  }));
};

export const upsertProduct = async (product: Product): Promise<void> => {
  // Map to snake_case for DB
  const dbRecord = {
    id: product.id,
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

export const deleteProductApi = async (id: string): Promise<void> => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

// Employees
export const fetchEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) throw error;
  
  return (data || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    department: e.department,
    role: e.role,
    joinedDate: e.joined_date || e.joinedDate || e.created_at
  }));
};

export const addEmployeeApi = async (employee: Employee): Promise<void> => {
  const dbRecord = {
    id: employee.id,
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
export const fetchAssignments = async (): Promise<Assignment[]> => {
  const { data, error } = await supabase.from('assignments').select('*');
  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    id: item.id,
    productId: item.product_id || item.productId,
    productName: item.product_name || item.productName,
    productNameZh: item.product_name_zh || item.productNameZh || '',
    employeeId: item.employee_id || item.employeeId,
    employeeName: item.employee_name || item.employeeName,
    quantity: item.quantity,
    assignedDate: item.assigned_date || item.assignedDate || item.created_at,
    status: item.status,
    performedBy: item.performed_by || item.performedBy
  }));
};

export const addAssignmentApi = async (assignment: Assignment): Promise<void> => {
  const dbRecord = {
    id: assignment.id,
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
export const fetchScrappedItems = async (): Promise<ScrappedItem[]> => {
  const { data, error } = await supabase.from('scrapped_items').select('*');
  if (error) throw error;
  
  const items = (data || []).map((item: any) => ({
    id: item.id,
    productId: item.product_id || item.productId,
    productName: item.product_name || item.productName,
    productNameZh: item.product_name_zh || item.productNameZh || '',
    quantity: item.quantity,
    reason: item.reason,
    scrappedDate: item.scrapped_date || item.scrappedDate || item.created_at,
    performedBy: item.performed_by || item.performedBy
  }));

  return items.sort((a, b) => new Date(b.scrappedDate).getTime() - new Date(a.scrappedDate).getTime());
};

export const addScrappedItemApi = async (item: ScrappedItem): Promise<void> => {
  const dbRecord = {
    id: item.id,
    product_id: item.productId,
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
export const fetchCategories = async (): Promise<string[]> => {
  const { data, error } = await supabase.from('categories').select('name');
  if (error) throw error;
  return data ? data.map((c: any) => c.name) : [];
};

export const addCategoryApi = async (name: string): Promise<void> => {
  const { error } = await supabase.from('categories').insert({ name });
  if (error) throw error;
};

export const deleteCategoryApi = async (name: string): Promise<void> => {
  const { error } = await supabase.from('categories').delete().eq('name', name);
  if (error) throw error;
};

// Stock Logs
export const fetchStockLogs = async (): Promise<StockLog[]> => {
  const { data, error } = await supabase.from('stock_logs').select('*');
  
  if (error) {
    console.warn("Stock logs fetch error:", error);
    return [];
  }

  const logs = (data || []).map((item: any) => ({
    id: item.id,
    action: item.action,
    productName: item.product_name || item.productName,
    quantity: item.quantity,
    performedBy: item.performed_by || item.performedBy,
    date: item.date || item.created_at,
    details: item.details
  }));

  return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addStockLogApi = async (log: StockLog): Promise<void> => {
  const dbRecord = {
    id: log.id,
    action: log.action,
    product_name: log.productName,
    quantity: log.quantity,
    performed_by: log.performedBy,
    date: log.date,
    details: log.details
  };
  const { error } = await supabase.from('stock_logs').insert(dbRecord);
  if (error) console.error("Failed to add stock log:", error);
};

// User Management
export const fetchAppUser = async (email: string): Promise<AppUser | null> => {
  const { data, error } = await supabase.from('app_users').select('*').eq('email', email).single();
  if (error) return null;
  return data;
};

export const createAppUser = async (user: AppUser): Promise<void> => {
  const { error } = await supabase.from('app_users').insert(user);
  if (error) throw error;
};

export const fetchAllUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const updateUserStatus = async (email: string, isApproved: boolean): Promise<void> => {
  const { error } = await supabase.from('app_users').update({ is_approved: isApproved }).eq('email', email);
  if (error) throw error;
};
