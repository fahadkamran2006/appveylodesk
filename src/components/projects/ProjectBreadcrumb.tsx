import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home, FolderKanban, User } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: 'home' | 'projects' | 'client';
}

interface ProjectBreadcrumbProps {
  items: BreadcrumbItem[];
}

const iconMap = {
  home: Home,
  projects: FolderKanban,
  client: User,
};

export function ProjectBreadcrumb({ items }: ProjectBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((item, index) => {
          const Icon = item.icon ? iconMap[item.icon] : null;
          const isLast = index === items.length - 1;

          return (
            <BreadcrumbItem key={index}>
              {item.href && !isLast ? (
                <BreadcrumbLink asChild>
                  <Link to={item.href} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {item.label}
                </BreadcrumbPage>
              )}
              {!isLast && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
