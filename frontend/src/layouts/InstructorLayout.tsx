import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Sparkles,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const InstructorLayout: React.FC = () => {
  const { profile, signOut, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/instructor', icon: LayoutDashboard },
    { label: 'My Courses', href: '/instructor/courses', icon: BookOpen },
    { label: 'Create Course', href: '/instructor/courses/new', icon: PlusCircle },
    { label: 'AI Drafts', href: '/instructor/ai-drafts', icon: Sparkles },
    { label: 'Analytics', href: '/instructor/analytics', icon: BarChart3 },
    { label: 'Profile', href: '/instructor/profile', icon: User },
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
          'hidden md:flex flex-col bg-white border-r border-border transition-all duration-200 z-30',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link to="/instructor" className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 bg-primary text-white rounded-lg shrink-0 shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            {sidebarOpen && (
              <div>
                <span className="font-extrabold text-base tracking-tight text-primary">DataCaliper</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">Instructor</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', sidebarOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/instructor' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white font-semibold shadow-sm'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-slate-50'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <Link
            to="/learner"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-charcoal-muted hover:text-charcoal hover:bg-slate-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Learner View</span>}
          </Link>

          {role === 'ADMIN' && (
            <Link
              to="/admin"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              {sidebarOpen && <span>Admin Portal</span>}
            </Link>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/60 px-1">
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-charcoal truncate">{profile?.full_name || 'Instructor'}</p>
                <p className="text-[10px] text-charcoal-muted truncate">{profile?.email}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile TopBar */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <Link to="/instructor" className="flex items-center gap-2 text-primary font-bold">
          <div className="p-1 bg-primary text-white rounded">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span>Instructor Portal</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-border px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                  isActive ? 'bg-primary text-white font-semibold' : 'text-charcoal-muted hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <Link to="/learner" className="text-xs text-primary font-medium">
              Switch to Learner View
            </Link>
            <button onClick={handleSignOut} className="text-xs text-rose-600 font-medium">
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
