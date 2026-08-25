import { Inbox } from 'lucide-react';
import { Icon } from './icon';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-zinc-400">
        {icon ?? <Icon icon={Inbox} size="xl" />}
      </div>
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-surface-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
