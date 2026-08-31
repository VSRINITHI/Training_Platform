import React from 'react';
import { Badge } from './Badge';
import { EnrollmentStatus, ModuleProgressStatus, AIDraftStatus, UserRole } from '../../types';

interface StatusBadgeProps {
  status?: EnrollmentStatus | ModuleProgressStatus | AIDraftStatus | UserRole | string | null;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  if (!status) return null;

  switch (status) {
    // Enrollment / Progress statuses
    case 'ACTIVE':
    case 'IN_PROGRESS':
      return <Badge variant="primary" className={className}>In Progress</Badge>;
    case 'COMPLETED':
    case 'APPROVED':
      return <Badge variant="success" className={className}>Completed</Badge>;
    case 'NEEDS_RELEARNING':
      return <Badge variant="warning" className={className}>Needs Relearning</Badge>;
    case 'NOT_STARTED':
      return <Badge variant="outline" className={className}>Not Started</Badge>;
    case 'CANCELLED':
    case 'DISCARDED':
      return <Badge variant="danger" className={className}>Discarded</Badge>;
    case 'PENDING_REVIEW':
      return <Badge variant="warning" className={className}>Pending Review</Badge>;

    // Roles
    case 'ADMIN':
      return <Badge variant="danger" className={className}>Admin</Badge>;
    case 'INSTRUCTOR':
      return <Badge variant="primary" className={className}>Instructor</Badge>;
    case 'USER':
      return <Badge variant="default" className={className}>Learner</Badge>;

    default:
      return <Badge variant="default" className={className}>{status}</Badge>;
  }
};
