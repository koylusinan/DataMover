import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Users, Shield } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    if (!hasRole('admin')) {
      navigate('/pipelines');
    }
  }, [hasRole, navigate]);

  const adminCards = [
    {
      title: 'Alert Preferences',
      description: 'Configure alert notifications for pipelines, webhooks, and data events',
      icon: Bell,
      path: '/admin/alerts',
      color: 'bg-blue-500',
      stats: 'Manage notifications'
    },
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions across the platform',
      icon: Users,
      path: '/admin/users',
      color: 'bg-green-500',
      stats: 'Control access'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Admin Panel
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Manage system settings, users, and alert configurations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                onClick={() => navigate(card.path)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 text-left border border-gray-200 dark:border-gray-700 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`${card.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      {card.description}
                    </p>
                    <div className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                      {card.stats}
                      <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
