import { Workflow, Box, Database, Activity, HelpCircle, Shield, User, LogOut, FlaskConical } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export function Sidebar() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const menuItems = [
    { id: 'pipelines', label: 'Pipelines', icon: Workflow, path: '/pipelines' },
    { id: 'models', label: 'Models', icon: Box, path: '/models' },
    { id: 'destinations', label: 'Destinations', icon: Database, path: '/destinations' },
    { id: 'monitoring', label: 'Monitoring', icon: Activity, path: '/monitoring' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };


  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'maintainer':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'read_only':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="w-[72px] bg-[#1a1d24] text-white flex flex-col fixed h-screen left-0 top-0 z-30">
      <div className="p-3 border-b border-gray-800">
        <NavLink to="/pipelines" className="flex items-center justify-center group">
          <div className="p-2 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors">
            <Workflow className="w-6 h-6 text-white" />
          </div>
        </NavLink>
      </div>

      <nav className="flex-1 flex flex-col py-4 px-2 gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-center p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`
              }
              title={item.label}
            >
              <Icon className="w-6 h-6" />
            </NavLink>
          );
        })}

        {profile?.role === 'admin' && (
          <>
            <div className="h-px bg-gray-800 my-2 mx-2" />
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center justify-center p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`
              }
              title="Admin Panel"
            >
              <Shield className="w-6 h-6" />
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-gray-800 p-2 space-y-1">
        <NavLink
          to="/test-rollback"
          className="flex items-center justify-center p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
          title="Test Rollback"
        >
          <FlaskConical className="w-6 h-6" />
        </NavLink>

        <NavLink
          to="/docs"
          className="flex items-center justify-center p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
          title="Help"
        >
          <HelpCircle className="w-6 h-6" />
        </NavLink>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center justify-center p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
            title="User menu"
          >
            <User className="w-6 h-6" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute left-full bottom-0 ml-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email || 'user@example.com'}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getRoleBadgeColor(profile?.role || 'read_only')}`}>
                      {profile?.role || 'read_only'}
                    </span>
                  </div>
                </div>

                {profile?.role === 'admin' && (
                  <button
                    onClick={() => {
                      navigate('/admin');
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </button>
                )}

                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
