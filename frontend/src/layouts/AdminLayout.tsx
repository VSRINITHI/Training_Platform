import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  FolderTree,
  Tags,
  Users,
  BookOpen,
  CheckSquare,
  BarChart3,
  Activity,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: ShieldAlert },
    { label: 'Domains', href: '/admin/domains', icon: FolderTree },
    { label: 'Sub-Domains', href: '/admin/sub-domains', icon: Tags },
    { label: 'Users & Roles', href: '/admin/users', icon: Users },
    { label: 'Course Oversight', href: '/admin/courses', icon: BookOpen },
    { label: 'Review / Governance', href: '/admin/review', icon: CheckSquare },
    { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { label: 'Activity', href: '/admin/activity', icon: Activity },
    { label: 'Profile', href: '/admin/profile', icon: User },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-slate-900 text-white border-r border-slate-800 transition-all duration-200 z-30',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <Link to="/admin" className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 bg-rose-600 text-white rounded-lg shrink-0 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            {sidebarOpen && (
              <div>
                <span className="font-extrabold text-base tracking-tight text-white">DataCaliper</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-rose-400">Admin Portal</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', sidebarOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-rose-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <Link
            to="/learner"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Learner View</span>}
          </Link>
          <Link
            to="/instructor"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Instructor View</span>}
          </Link>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 px-1">
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{profile?.full_name || 'Admin'}</p>
                <p className="text-[10px] text-slate-400 truncate">{profile?.email}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile TopBar */}
      <header className="md:hidden sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link to="/admin" className="flex items-center gap-2 font-bold">
          <div className="p-1 bg-rose-600 text-white rounded">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <span>Admin Portal</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-1 text-white">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                  isActive ? 'bg-rose-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <Link to="/learner" className="text-xs text-indigo-400 font-medium">
              Switch to Learner View
            </Link>
            <button onClick={handleSignOut} className="text-xs text-rose-400 font-medium">
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
