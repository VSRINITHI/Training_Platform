import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  FolderTree,
  Tags,
  BookOpen,
  Users,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { domainsApi } from '../../api/domains';
import { subDomainsApi } from '../../api/subDomains';
import { coursesApi } from '../../api/courses';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';

export const AdminDashboardPage: React.FC = () => {
  const { data: domains = [] } = useQuery({
    queryKey: ['admin-dash-domains'],
    queryFn: domainsApi.list,
  });

  const { data: subDomains = [] } = useQuery({
    queryKey: ['admin-dash-subdomains'],
    queryFn: () => subDomainsApi.list(),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['admin-dash-courses'],
    queryFn: () => coursesApi.list({ my_authored: true }),
  });

  const publishedCourses = courses.filter((c) => c.is_published);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Governance & Platform Oversight"
        description="Manage domain taxonomy, sub-domain specializations, user role promotions, and platform-wide course publishing."
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Subject Domains</span>
            <FolderTree className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{domains.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Sub-Domains / Topics</span>
            <Tags className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{subDomains.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Total Courses</span>
            <BookOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-charcoal mt-2">{courses.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-charcoal-muted">Published Courses</span>
            <BookOpen className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{publishedCourses.length}</p>
        </div>
      </div>

      {/* Quick Governance Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-2.5 bg-indigo-50 text-primary rounded-xl w-fit">
              <FolderTree className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-charcoal">Taxonomy & Domains</h3>
            <p className="text-xs text-charcoal-muted leading-relaxed">
              Create, edit, and organize subject domains and technical sub-domains.
            </p>
          </div>
          <Link to="/admin/domains">
            <Button size="sm" variant="outline" className="w-full" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Manage Domains
            </Button>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl w-fit">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-charcoal">User Role Management</h3>
            <p className="text-xs text-charcoal-muted leading-relaxed">
              Assign staff roles (<code className="font-mono text-xs">INSTRUCTOR</code> / <code className="font-mono text-xs">ADMIN</code>) to users.
            </p>
          </div>
          <Link to="/admin/users">
            <Button size="sm" variant="outline" className="w-full" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Manage Roles
            </Button>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-charcoal">Course Oversight</h3>
            <p className="text-xs text-charcoal-muted leading-relaxed">
              Inspect system-wide course publication status and curriculum checkpoints.
            </p>
          </div>
          <Link to="/admin/courses">
            <Button size="sm" variant="outline" className="w-full" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Inspect Courses
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
