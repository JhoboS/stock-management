
import React from 'react';
import { LayoutDashboard, Package, Users, Trash2, Settings as SettingsIcon, ClipboardList } from 'lucide-react';
// Import the logo relative to this file (components folder -> up one level -> logo.png)
import logo from '../logo.png';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'employees', label: 'Staff Management', icon: Users },
    { id: 'logs', label: 'History & Logs', icon: ClipboardList },
    { id: 'scrapped', label: 'Scrap Log', icon: Trash2 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 shadow-xl z-20">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-700">
        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden shrink-0 p-1">
           {/* Use the imported logo variable here */}
           <img src={logo} alt="GR Logo" className="w-full h-full object-contain" />
        </div>
        <div>
            <h1 className="text-lg font-bold tracking-wide leading-none">Great River</h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Stock Management</p>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-lime-600 text-white shadow-lg shadow-lime-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">Great River System</p>
          <p>v1.5.0 • Powered by Gemini</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
