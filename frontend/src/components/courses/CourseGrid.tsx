import React from 'react';
import { Course } from '../../types';
import { CourseCard } from './CourseCard';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

interface CourseGridProps {
  courses: Course[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClearFilters?: () => void;
  enrolledCourseIds?: Set<string>;
  progressMap?: Record<string, number>;
}

export const CourseGrid: React.FC<CourseGridProps> = ({
  courses,
  isLoading = false,
  emptyTitle = 'No courses found',
  emptyDescription = 'Try adjusting your search query or filters to find available learning tracks.',
  onClearFilters,
  enrolledCourseIds = new Set(),
  progressMap = {},
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-4 space-y-3">
            <Skeleton className="h-36 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="pt-4 flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const courseList = Array.isArray(courses) ? courses : [];

  if (courseList.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={onClearFilters ? 'Clear Filters' : undefined}
        onAction={onClearFilters}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {courseList.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          isEnrolled={enrolledCourseIds.has(course.id)}
          progressPct={progressMap[course.id]}
        />
      ))}
    </div>
  );
};
