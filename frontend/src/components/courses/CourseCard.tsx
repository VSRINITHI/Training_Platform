import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, BarChart, ArrowRight, User } from 'lucide-react';
import { Course, DifficultyLevel } from '../../types';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

interface CourseCardProps {
  course: Course;
  progressPct?: number;
  isEnrolled?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  progressPct,
  isEnrolled = false,
}) => {
  const difficultyVariants: Record<DifficultyLevel, 'default' | 'primary' | 'warning' | 'danger'> = {
    BEGINNER: 'default',
    INTERMEDIATE: 'primary',
    ADVANCED: 'warning',
  };

  return (
    <div className="flex flex-col bg-white rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden group">
      {/* Course Banner / Thumbnail */}
      <div className="h-40 bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100/50 p-4 flex flex-col justify-between relative border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          {course.sub_domain && (
            <Badge variant="outline" size="sm" className="bg-white/90 backdrop-blur-sm">
              {course.sub_domain.name}
            </Badge>
          )}
          {course.difficulty_level && (
            <Badge variant={difficultyVariants[course.difficulty_level]} size="sm">
              {course.difficulty_level.charAt(0) + course.difficulty_level.slice(1).toLowerCase()}
            </Badge>
          )}
        </div>

        <div>
          <h3 className="text-base font-bold text-charcoal group-hover:text-primary transition-colors line-clamp-2">
            {course.title}
          </h3>
        </div>
      </div>

      {/* Course Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <p className="text-xs text-charcoal-muted line-clamp-2 mb-4 leading-relaxed">
          {course.description}
        </p>

        <div className="space-y-3 pt-2 border-t border-border/60">
          {/* Instructor & Module Count */}
          <div className="flex items-center justify-between text-xs text-charcoal-muted">
            <div className="flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{course.instructor?.full_name || 'Instructor'}</span>
            </div>
            {course.modules && (
              <div className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>{course.modules.length} modules</span>
              </div>
            )}
          </div>

          {/* Progress or CTA */}
          {isEnrolled && progressPct !== undefined ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-charcoal">
                <span>Progress</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <ProgressBar value={progressPct} size="sm" />
            </div>
          ) : null}

          <Link
            to={isEnrolled ? `/learner/learning/${course.id}` : `/learner/courses/${course.id}`}
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold text-primary bg-primary-light hover:bg-indigo-100 transition-colors group-hover:bg-primary group-hover:text-white"
          >
            <span>{isEnrolled ? 'Continue Learning' : 'View Course'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
