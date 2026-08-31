import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { domainsApi } from '../../api/domains';
import { coursesApi } from '../../api/courses';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { CourseGrid } from '../../components/courses/CourseGrid';
import { DomainCard } from '../../components/courses/DomainCard';

export const LandingPage: React.FC = () => {
  const { user, role } = useAuth();

  const { data: domains = [], isLoading: loadingDomains } = useQuery({
    queryKey: ['landing-domains'],
    queryFn: domainsApi.list,
  });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['landing-courses'],
    queryFn: () => coursesApi.list(),
  });

  const destinationHref = user
    ? role === 'ADMIN'
      ? '/admin'
      : role === 'INSTRUCTOR'
      ? '/instructor'
      : '/learner'
    : '/register';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary font-extrabold text-xl tracking-tight">
            <div className="p-1.5 bg-primary text-white rounded-lg shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span>DataCaliper</span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Link to={destinationHref}>
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 bg-gradient-to-b from-indigo-50/60 via-white to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Skill Mastery & Learning Lifecycle</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-charcoal tracking-tight max-w-3xl mx-auto leading-tight sm:leading-none">
            Learn skills. <br />
            <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-emphasis">
              Build your future.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-charcoal-muted max-w-2xl mx-auto leading-relaxed">
            Personalized, modular learning paths curated across technology, engineering, and data science. Take mastery assessments, unlock progressive chapters, and earn verified certificates.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={destinationHref}>
              <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="w-full sm:w-auto px-8 shadow-md">
                Explore Courses
              </Button>
            </Link>
            {!user && (
              <Link to="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
                  Sign In to Account
                </Button>
              </Link>
            )}
          </div>

          {/* Key Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-border/80">
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-charcoal">{courses.length}+</p>
              <p className="text-xs text-charcoal-muted mt-0.5">Published Courses</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-charcoal">{domains.length}</p>
              <p className="text-xs text-charcoal-muted mt-0.5">Subject Domains</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-charcoal">100%</p>
              <p className="text-xs text-charcoal-muted mt-0.5">Verified Knowledge</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-charcoal">Free</p>
              <p className="text-xs text-charcoal-muted mt-0.5">Self-Paced Learning</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses Section */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Curriculum Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-charcoal">Featured Courses</h2>
          </div>
          <Link to="/learner/discover" className="text-xs font-semibold text-primary hover:underline mt-2 sm:mt-0 flex items-center gap-1">
            Browse all courses <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <CourseGrid
          courses={courses.slice(0, 6)}
          isLoading={loadingCourses}
        />
      </section>

      {/* Subject Domains Section */}
      <section className="py-16 bg-white border-t border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-charcoal">Explore by Domain</h2>
            <p className="text-xs sm:text-sm text-charcoal-muted mt-1.5">
              Select a specialized domain to discover structured curriculums and module assessments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {domains.map((domain) => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-2 font-extrabold text-xl">
              <div className="p-1.5 bg-primary text-white rounded-lg">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span>DataCaliper</span>
            </div>
            <p className="text-xs text-slate-400">
              Modern competency-based training platform with interactive scoring and audit verification.
            </p>
          </div>
          <div className="pt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} DataCaliper. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
