import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  BookOpen,
  TrendingUp,
  Award,
  User,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const LearnerLayout: React.FC = () => {
  const { profile, signOut, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/learner', icon: BookOpen },
    { label: 'Discover', href: '/learner/discover', icon: Compass },
    { label: 'My Progress', href: '/learner/progress', icon: TrendingUp },
    { label: 'Certificates', href: '/learner/certificates', icon: Award },
    { label: 'Profile', href: '/learner/profile', icon: User },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link to="/learner" className="flex items-center gap-2 text-primary font-extrabold text-xl tracking-tight">
                <div className="p-1.5 bg-primary text-white rounded-lg shadow-sm">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span>DataCaliper</span>
              </Link>

              {/* Desktop Nav links */}
              <nav className="hidden md:flex items-center space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href || (item.href !== '/learner' && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-light text-primary font-semibold'
                          : 'text-charcoal-muted hover:text-charcoal hover:bg-slate-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Header Menu */}
            <div className="flex items-center gap-3">
              {/* Role portal switcher if staff */}
              {role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Admin Portal
                </Link>
              )}
              {role === 'INSTRUCTOR' && (
                <Link
                  to="/instructor"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Instructor Portal
                </Link>
              )}

              {/* User badge */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                  {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-semibold text-charcoal leading-tight">{profile?.full_name || 'Learner'}</p>
                  <p className="text-[11px] text-charcoal-muted leading-tight">{profile?.email}</p>
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-flex p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile Menu Trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:text-charcoal hover:bg-slate-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
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
                    isActive ? 'bg-primary-light text-primary font-semibold' : 'text-charcoal-muted hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-charcoal">{profile?.full_name || 'Learner'}</p>
                <p className="text-[11px] text-charcoal-muted">{profile?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-md"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border py-4 text-center text-xs text-charcoal-muted">
        <div className="max-w-7xl mx-auto px-4">
          © {new Date().getFullYear()} DataCaliper Training Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
