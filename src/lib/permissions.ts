export interface PermissionDef {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionGroup {
  title: string;
  area: 'operations' | 'finance' | 'hr' | 'workspace';
  permissions: PermissionDef[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    title: 'Clients',
    area: 'operations',
    permissions: [
      { key: 'clients.view', label: 'View clients' },
      { key: 'clients.create', label: 'Add manual clients' },
      { key: 'clients.invite', label: 'Invite clients' },
      { key: 'clients.edit', label: 'Edit client details' },
      { key: 'clients.delete', label: 'Remove clients' },
    ],
  },
  {
    title: 'Projects',
    area: 'operations',
    permissions: [
      { key: 'projects.view', label: 'View projects' },
      { key: 'projects.create', label: 'Create projects' },
      { key: 'projects.edit', label: 'Edit projects' },
      { key: 'projects.assign_editor', label: 'Assign editors' },
      { key: 'projects.change_status', label: 'Change status (kanban)' },
      { key: 'projects.delete', label: 'Delete projects' },
    ],
  },
  {
    title: 'Team',
    area: 'operations',
    permissions: [
      { key: 'team.view', label: 'View team members' },
      { key: 'team.invite', label: 'Invite editors / staff' },
      { key: 'team.edit', label: 'Edit team members' },
      { key: 'team.remove', label: 'Remove team members' },
    ],
  },
  {
    title: 'Messaging',
    area: 'operations',
    permissions: [
      { key: 'messaging.dm_clients', label: 'Direct message clients' },
      { key: 'messaging.dm_team', label: 'Direct message team' },
      { key: 'messaging.project_channels', label: 'Access project channels' },
    ],
  },
  {
    title: 'Invoices & Payments',
    area: 'finance',
    permissions: [
      { key: 'invoices.view', label: 'View invoices' },
      { key: 'invoices.create', label: 'Create invoices' },
      { key: 'invoices.send', label: 'Send invoices to clients' },
      { key: 'invoices.mark_paid', label: 'Mark invoices as paid' },
      { key: 'payments.view_methods', label: 'View payment methods' },
      { key: 'payments.manage_methods', label: 'Manage payment methods' },
    ],
  },
  {
    title: 'Payroll',
    area: 'finance',
    permissions: [
      { key: 'payroll.view', label: 'View payroll' },
      { key: 'payroll.pay', label: 'Process payments' },
      { key: 'payroll.bonuses', label: 'Add bonuses' },
      { key: 'payroll.balances', label: 'Adjust balances' },
    ],
  },
  {
    title: 'Attendance & Leave',
    area: 'hr',
    permissions: [
      { key: 'attendance.view', label: 'View attendance' },
      { key: 'attendance.report', label: 'Send attendance reports' },
      { key: 'leave.view', label: 'View leave requests' },
      { key: 'leave.approve', label: 'Approve / reject leave' },
      { key: 'performance.view', label: 'View performance metrics' },
    ],
  },
  {
    title: 'Workspace',
    area: 'workspace',
    permissions: [
      { key: 'storage.view', label: 'View storage / drive' },
      { key: 'storage.upload', label: 'Upload files' },
      { key: 'storage.delete', label: 'Delete files' },
      { key: 'branding.manage', label: 'Manage branding' },
      { key: 'settings.manage', label: 'Manage agency settings' },
      { key: 'billing.manage', label: 'Manage billing & subscription' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.flatMap((g) => g.permissions.map((p) => p.key));
