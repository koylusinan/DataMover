import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { DetailModal } from '../components/ui/DetailModal';
import { ArrowLeft, User, Mail, Calendar, Activity, Database, Clock, Loader2, Shield, CreditCard as Edit2, Ban, CheckCircle, ChevronRight, X, Bell, ChevronDown, MessageSquare, LayoutDashboard } from 'lucide-react';

interface ActivityLog {
  id: string;
  action_type: string;
  action_description: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: any;
  created_at: string;
}

interface UserStats {
  total_pipelines: number;
  active_pipelines: number;
  total_activities: number;
  last_login: string | null;
}

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { hasRole, user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // Removed: Alert recipient state variables (moved to Defined Alarms)
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: 'read_only' as UserRole,
    change_email: false,
    new_email: '',
    change_password: false,
    new_password: ''
  });

  useEffect(() => {
    if (!hasRole('admin')) {
      navigate('/pipelines');
      return;
    }

    if (userId) {
      fetchUserDetails();
      fetchUserStats();
      fetchUserActivities();
      // Removed: fetchAlertRecipients() - moved to Defined Alarms
    }
  }, [userId, hasRole, navigate]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error fetching user:', error);
      showToast('error', 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const { count: totalPipelines } = await supabase
        .from('pipelines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: activePipelines } = await supabase
        .from('pipelines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'running');

      const { count: totalActivities } = await supabase
        .from('user_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { data: lastLogin } = await supabase
        .from('user_activity_logs')
        .select('created_at')
        .eq('user_id', userId)
        .eq('action_type', 'auth.login')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({
        total_pipelines: totalPipelines || 0,
        active_pipelines: activePipelines || 0,
        total_activities: totalActivities || 0,
        last_login: lastLogin?.created_at || null,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserActivities = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (activityFilter !== 'all') {
        query = query.ilike('action_type', `${activityFilter}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      showToast('error', 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserActivities();
    }
  }, [activityFilter]);

  const toggleUserStatus = async () => {
    if (!user) return;

    try {
      const newStatus = !user.is_active;
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, is_active: newStatus });
      showToast('success', `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      console.error('Error updating user status:', error);
      showToast('error', error.message || 'Failed to update user status');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const updatePayload: any = {
        user_id: user.id,
        full_name: editForm.full_name,
        role: editForm.role,
      };

      if (editForm.change_email && editForm.new_email) {
        updatePayload.new_email = editForm.new_email;
      }

      if (editForm.change_password && editForm.new_password) {
        updatePayload.new_password = editForm.new_password;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      const updatedUser = {
        ...user,
        full_name: editForm.full_name,
        role: editForm.role,
        email: editForm.change_email ? editForm.new_email : user.email,
      };

      setUser(updatedUser);
      setShowEditModal(false);
      showToast('success', 'User updated successfully');
    } catch (error: any) {
      console.error('Error updating user:', error);
      showToast('error', error.message || 'Failed to update user');
    }
  };

  // Removed: Alert recipient functions - moved to Defined Alarms in pipeline monitoring
  // - fetchPipelines()
  // - fetchAlertRecipients()
  // - toggleAlertExpand()
  // - getChannelIcon()
  // - handleAddAlert()

  const openEditModal = () => {
    if (user) {
      setEditForm({
        full_name: user.full_name || '',
        role: user.role,
        change_email: false,
        new_email: '',
        change_password: false,
        new_password: ''
      });
      setShowEditModal(true);
    }
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.startsWith('auth.')) return <Shield className="w-4 h-4" />;
    if (actionType.startsWith('pipeline.')) return <Database className="w-4 h-4" />;
    if (actionType.startsWith('user.')) return <User className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('create')) return 'text-green-600 bg-green-50 dark:bg-green-900/30';
    if (actionType.includes('delete')) return 'text-red-600 bg-red-50 dark:bg-red-900/30';
    if (actionType.includes('update')) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/30';
    if (actionType.includes('login')) return 'text-purple-600 bg-purple-50 dark:bg-purple-900/30';
    return 'text-gray-600 bg-gray-50 dark:bg-gray-900/30';
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-8">
      <div className="mb-6 flex-shrink-0">
        <button
          onClick={() => navigate('/admin/users')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {user.full_name || 'N/A'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-2">{user.email}</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </span>
                <span
                  className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                    user.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddAlertModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Bell className="w-4 h-4" />
              Add Alert
            </button>
            <button
              onClick={openEditModal}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={toggleUserStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                user.is_active
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {user.is_active ? (
                <>
                  <Ban className="w-4 h-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Activate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Pipelines</p>
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats?.total_pipelines || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Pipelines</p>
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats?.active_pipelines || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Activities</p>
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats?.total_activities || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Last Login</p>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {stats?.last_login ? new Date(stats.last_login).toLocaleDateString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Alert Assignments section removed - moved to Defined Alarms in pipeline monitoring */}

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          User Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="text-gray-900 dark:text-gray-100">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Full Name</p>
              <p className="text-gray-900 dark:text-gray-100">{user.full_name || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Role</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{user.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm flex flex-col flex-1 min-h-0">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Activity History
            </h2>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Activities</option>
              <option value="auth">Authentication</option>
              <option value="pipeline">Pipelines</option>
              <option value="user">User Actions</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No activity logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                    activity.action_type.includes('update') && Object.keys(activity.metadata?.changes || {}).length > 0
                      ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => {
                    if (activity.action_type.includes('update') && Object.keys(activity.metadata?.changes || {}).length > 0) {
                      setSelectedLog(activity);
                    }
                  }}
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${getActionColor(activity.action_type)}`}>
                    {getActionIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {activity.action_type}
                      </p>
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {activity.action_description}
                    </p>
                  </div>
                  {activity.action_type.includes('update') && Object.keys(activity.metadata?.changes || {}).length > 0 && (
                    <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLog && (
        <DetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}

      {/* Alert modal removed - email notifications deprecated */}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit User</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="read_only">Read Only</option>
                  <option value="maintainer">Maintainer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.change_email}
                    onChange={(e) => setEditForm({ ...editForm, change_email: e.target.checked, new_email: '' })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Change Email
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.change_password}
                    onChange={(e) => setEditForm({ ...editForm, change_password: e.target.checked, new_password: '' })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Change Password
                  </span>
                </label>
              </div>

              {editForm.change_email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Email
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.new_email}
                    onChange={(e) => setEditForm({ ...editForm, new_email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new email"
                  />
                </div>
              )}

              {editForm.change_password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={editForm.new_password}
                    onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Minimum 6 characters
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
