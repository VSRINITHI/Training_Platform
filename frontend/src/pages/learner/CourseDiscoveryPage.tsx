import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X, Compass, SlidersHorizontal } from 'lucide-react';
import { coursesApi } from '../../api/courses';
import { domainsApi } from '../../api/domains';
import { subDomainsApi } from '../../api/subDomains';
import { progressApi } from '../../api/progress';
import { DifficultyLevel } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { CourseGrid } from '../../components/courses/CourseGrid';

export const CourseDiscoveryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const domainFilter = searchParams.get('domain') || '';
  const subDomainFilter = searchParams.get('subDomain') || '';
  const difficultyFilter = (searchParams.get('difficulty') as DifficultyLevel) || '';
  const searchQuery = searchParams.get('q') || '';

  const [localSearch, setLocalSearch] = useState(searchQuery);

  // 1. Fetch Domains
  const { data: domains = [] } = useQuery({
    queryKey: ['discovery-domains'],
    queryFn: domainsApi.list,
  });

  // 2. Fetch Sub-domains (filtered by selected domain if any)
  const { data: subDomains = [] } = useQuery({
    queryKey: ['discovery-sub-domains', domainFilter],
    queryFn: () => subDomainsApi.list(domainFilter || undefined),
  });

  // 3. Fetch Courses with filters
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['discovery-courses', subDomainFilter, difficultyFilter, searchQuery],
    queryFn: () =>
      coursesApi.list({
        sub_domain_id: subDomainFilter || undefined,
        difficulty_level: difficultyFilter || undefined,
        search: searchQuery || undefined,
      }),
  });

  // 4. Fetch user's enrollments to indicate enrolled status
  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: progressApi.getMyEnrollments,
  });

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.course_id)),
    [enrollments]
  );

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    // Reset sub-domain if domain changes
    if (key === 'domain') {
      newParams.delete('subDomain');
    }
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('q', localSearch);
  };

  const clearAllFilters = () => {
    setLocalSearch('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(domainFilter || subDomainFilter || difficultyFilter || searchQuery);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore Courses"
        description="Discover competency-based learning tracks, interactive lessons, and certification assessments."
        badge={
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-light text-primary">
            {courses.length} Available
          </span>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-border shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="flex-1">
            <SearchInput
              placeholder="Search courses by title, topic, or keyword..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onClear={() => {
                setLocalSearch('');
                updateFilter('q', '');
              }}
            />
          </div>
          <Button type="submit" size="md">
            Search
          </Button>
        </form>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
          {/* Domain Filter */}
          <Select
            value={domainFilter}
            onChange={(e) => updateFilter('domain', e.target.value)}
            placeholder="All Subject Domains"
          >
            <option value="">All Subject Domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          {/* Sub-Domain Filter */}
          <Select
            value={subDomainFilter}
            onChange={(e) => updateFilter('subDomain', e.target.value)}
            placeholder="All Technical Topics"
            disabled={subDomains.length === 0}
          >
            <option value="">All Technical Topics</option>
            {subDomains.map((sd) => (
              <option key={sd.id} value={sd.id}>
                {sd.name}
              </option>
            ))}
          </Select>

          {/* Difficulty Filter */}
          <Select
            value={difficultyFilter}
            onChange={(e) => updateFilter('difficulty', e.target.value)}
            placeholder="All Difficulty Levels"
          >
            <option value="">All Difficulty Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </Select>
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-charcoal-muted font-medium">Active filters:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-charcoal font-medium">
                  Search: "{searchQuery}"
                  <button onClick={() => updateFilter('q', '')} className="hover:text-danger">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {domainFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-charcoal font-medium">
                  Domain: {domains.find((d) => d.id === domainFilter)?.name || 'Selected'}
                  <button onClick={() => updateFilter('domain', '')} className="hover:text-danger">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {subDomainFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-charcoal font-medium">
                  Topic: {subDomains.find((sd) => sd.id === subDomainFilter)?.name || 'Selected'}
                  <button onClick={() => updateFilter('subDomain', '')} className="hover:text-danger">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {difficultyFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-charcoal font-medium">
                  Level: {difficultyFilter}
                  <button onClick={() => updateFilter('difficulty', '')} className="hover:text-danger">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={clearAllFilters}
              className="text-primary hover:text-primary-hover font-semibold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Course Grid */}
      <CourseGrid
        courses={courses}
        isLoading={isLoading}
        enrolledCourseIds={enrolledCourseIds}
        onClearFilters={hasActiveFilters ? clearAllFilters : undefined}
      />
    </div>
  );
};
