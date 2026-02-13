import { Badge } from '@/components/ui';
import { AgentStatus } from '@/types';

interface AgentStatusBadgeProps {
  status: AgentStatus;
}

/**
 * Get badge variant for agent status
 */
const getAgentStatusVariant = (
  status: AgentStatus
): 'success' | 'default' | 'danger' => {
  switch (status) {
    case AgentStatus.ONLINE:
      return 'success';
    case AgentStatus.OFFLINE:
      return 'default';
    case AgentStatus.ERROR:
      return 'danger';
    default:
      return 'default';
  }
};

/**
 * Get display label for agent status
 */
const getAgentStatusLabel = (status: AgentStatus): string => {
  switch (status) {
    case AgentStatus.ONLINE:
      return 'Online';
    case AgentStatus.OFFLINE:
      return 'Offline';
    case AgentStatus.ERROR:
      return 'Error';
    default:
      return status;
  }
};

/**
 * Badge component for displaying agent status
 */
export const AgentStatusBadge = ({ status }: AgentStatusBadgeProps) => {
  return (
    <Badge variant={getAgentStatusVariant(status)}>
      {getAgentStatusLabel(status)}
    </Badge>
  );
};
