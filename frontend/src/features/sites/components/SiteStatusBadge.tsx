import { Badge } from '@/components/ui';
import { SiteStatus } from '@/types';

interface SiteStatusBadgeProps {
  status: SiteStatus;
}

/**
 * Get badge variant for site operational status
 */
const getSiteStatusVariant = (status: SiteStatus): 'success' | 'warning' | 'danger' | 'default' => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'INACTIVE':
      return 'default';
    case 'ERROR':
      return 'danger';
    default:
      return 'default';
  }
};

/**
 * Get display label for site operational status
 */
const getSiteStatusLabel = (status: SiteStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'PENDING':
      return 'Pending';
    case 'INACTIVE':
      return 'Inactive';
    case 'ERROR':
      return 'Error';
    default:
      return status;
  }
};

/**
 * Badge component for displaying site operational status
 */
export const SiteStatusBadge = ({ status }: SiteStatusBadgeProps) => {
  return (
    <Badge variant={getSiteStatusVariant(status)}>
      {getSiteStatusLabel(status)}
    </Badge>
  );
};
