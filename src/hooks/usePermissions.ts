import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
  const { profile, hasRoleLevel } = useAuth();

  const canCreatePipeline = hasRoleLevel('maintainer');
  const canEditPipeline = hasRoleLevel('maintainer');
  const canDeletePipeline = hasRoleLevel('maintainer');
  const canManageUsers = profile?.role === 'admin';
  const isReadOnly = profile?.role === 'read_only';

  return {
    canCreatePipeline,
    canEditPipeline,
    canDeletePipeline,
    canManageUsers,
    isReadOnly,
  };
}
