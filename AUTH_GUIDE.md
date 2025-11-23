# Authentication & Role-Based Access Control Guide

This document describes the complete authentication and RBAC (Role-Based Access Control) system implemented in the application.

## Overview

The application now features a comprehensive authentication system with three distinct user roles, each with specific permissions and capabilities.

## User Roles

### 1. Admin (Full System Access)
- **Full user management**: Create, edit, and delete users
- **Role assignment**: Change user roles and manage permissions
- **User activation/deactivation**: Control account status
- **View all pipelines**: Access to all pipelines across all users
- **View all activity logs**: Complete audit trail of system activity
- **Full pipeline management**: Create, edit, and delete any pipeline
- **Access admin panel**: Exclusive access to user management interface

### 2. Maintainer (Pipeline Management)
- **Full pipeline operations**: Create, edit, and delete own pipelines
- **Source/destination management**: Configure and manage connections
- **View own activity logs**: Access to personal activity history
- **No user management**: Cannot create, edit, or delete users
- **No role changes**: Cannot modify user permissions
- **Limited visibility**: Can only see and manage own pipelines

### 3. Read Only (View-Only Access)
- **View pipelines**: Browse and view all pipeline information
- **View configurations**: Access to pipeline settings (read-only)
- **View logs**: Access to pipeline logs and monitoring data
- **No modifications**: Cannot create, edit, or delete anything
- **Disabled actions**: All action buttons are disabled with visual indicators
- **View activity logs**: Access to own activity history

## Key Features

### Authentication
- **Email/password authentication**: Secure login using Supabase Auth
- **User registration**: New users can sign up (default role: read_only)
- **Session management**: Automatic token refresh and session handling
- **Profile management**: Users can update their own profile information
- **Last login tracking**: Automatic recording of login timestamps

### Activity Logging
- **Comprehensive tracking**: All user actions are logged automatically
- **Action types**: Login/logout, pipeline CRUD, user management, configuration changes
- **Metadata capture**: IP address, user agent, timestamps, and context
- **Audit trail**: Complete history for compliance and debugging
- **Export functionality**: Download logs in CSV format
- **Filtering**: Search and filter by action type, date range, and user

### Security
- **Row Level Security (RLS)**: Database-level access control
- **Role-based policies**: Permissions enforced at the database level
- **Profile validation**: Account activation status checked on login
- **Protected routes**: Automatic redirection for unauthorized access
- **Password requirements**: Minimum 6 characters enforced
- **Secure storage**: Passwords hashed using Supabase Auth

## Database Schema

### user_profiles
Stores extended user profile information:
- `id` - References auth.users(id)
- `email` - User email address
- `full_name` - User's full name
- `role` - User role (admin, maintainer, read_only)
- `is_active` - Account activation status
- `created_at` - Account creation timestamp
- `updated_at` - Last profile update
- `last_login_at` - Last successful login

### user_activity_logs
Tracks all user actions:
- `id` - Unique log identifier
- `user_id` - Reference to user_profiles
- `action_type` - Type of action (e.g., "pipeline.create")
- `action_description` - Human-readable description
- `resource_type` - Type of affected resource
- `resource_id` - ID of affected resource
- `metadata` - Additional context (JSON)
- `ip_address` - User's IP address
- `user_agent` - Browser/client information
- `created_at` - Action timestamp

## Admin Panel

Located at `/admin/users` (admin-only), the admin panel provides:

### User Management
- **User list**: View all registered users with statistics
- **Create user**: Add new users with specific roles
- **Edit user**: Update user information and roles
- **Delete user**: Remove users from the system
- **Toggle activation**: Enable/disable user accounts
- **Search functionality**: Find users by email or name
- **Role statistics**: Visual breakdown of users by role

### Dashboard Metrics
- Total user count
- Users by role (admin, maintainer, read_only)
- Pipeline count per user
- Last activity timestamps
- Active sessions

## Activity Logs

Located at `/admin/activity-logs`, provides:

### Features
- **Real-time view**: All system activity in chronological order
- **Search**: Find specific actions or users
- **Filter by action type**: Narrow down to specific operations
- **Date filtering**: View logs from today, last week, or last month
- **Export**: Download logs in CSV format
- **Color coding**: Visual indicators for different action types
- **Metadata expansion**: View detailed context for each action

### Action Types
- `auth.login` - User login
- `auth.logout` - User logout
- `user.create` - User creation
- `user.update` - User profile update
- `user.delete` - User deletion
- `pipeline.create` - Pipeline creation
- `pipeline.update` - Pipeline modification
- `pipeline.delete` - Pipeline deletion
- `profile.update` - Profile information update

## Implementation Details

### Frontend Components

#### AuthContext (`src/contexts/AuthContext.tsx`)
- Manages authentication state
- Provides user session and profile
- Exposes authentication methods (signIn, signUp, signOut)
- Implements role checking utilities
- Handles activity logging

#### ProtectedRoute (`src/components/auth/ProtectedRoute.tsx`)
- Guards routes requiring authentication
- Checks required role levels
- Displays access denied messages
- Redirects to login when needed

#### LoginPage & SignupPage
- Clean, modern authentication UI
- Password visibility toggle
- Form validation
- Error handling
- Automatic navigation on success

#### AdminPage (`src/pages/AdminPage.tsx`)
- Complete user management interface
- CRUD operations for users
- Role assignment
- Account activation
- Statistics dashboard

#### ActivityLogsPage (`src/pages/ActivityLogsPage.tsx`)
- Activity log viewer
- Search and filtering
- Export functionality
- Detailed log inspection

### Database Functions

#### `has_role(required_role text)`
Checks if the current user has a specific role.

#### `has_role_level(minimum_role text)`
Checks if the current user has at least the specified role level.

#### `log_user_activity(...)`
Creates a new activity log entry with provided details.

### RLS Policies

All tables have comprehensive RLS policies:
- **user_profiles**: Admin can manage all, users can view/update own
- **user_activity_logs**: Admin sees all, users see own logs
- **pipelines**: Admin sees all, others see own; maintainer+ can modify
- **pipeline_objects**: Inherits pipeline permissions
- **job_runs**: Read access based on pipeline ownership
- **pipeline_logs**: Read access based on pipeline ownership

## Getting Started

### For Administrators

1. **Access Admin Panel**:
   - Navigate to `/admin/users` (sidebar icon or user menu)
   - View all registered users and statistics

2. **Create Users**:
   - Click "Create User" button
   - Enter email, password, full name
   - Select appropriate role
   - Click "Create User"

3. **Manage Roles**:
   - Click edit icon on user row
   - Change role dropdown
   - Toggle active status
   - Click "Save Changes"

4. **View Activity**:
   - Click "Activity Logs" in user menu
   - Filter and search as needed
   - Export for compliance/auditing

### For Users

1. **Sign Up**:
   - Navigate to `/signup`
   - Enter email, password, and full name
   - Click "Create Account"
   - Default role will be "read_only"

2. **Sign In**:
   - Navigate to `/login`
   - Enter credentials
   - Click "Sign In"
   - Redirected to pipelines page

3. **View Profile**:
   - Click user icon in header
   - View email and current role
   - Access activity logs

4. **Sign Out**:
   - Click user icon in header
   - Click "Sign Out"

## Permission Matrix

| Action | Admin | Maintainer | Read Only |
|--------|-------|------------|-----------|
| View own pipelines | ✅ | ✅ | ✅ |
| View all pipelines | ✅ | ❌ | ❌ |
| Create pipeline | ✅ | ✅ | ❌ |
| Edit own pipeline | ✅ | ✅ | ❌ |
| Delete own pipeline | ✅ | ✅ | ❌ |
| Edit any pipeline | ✅ | ❌ | ❌ |
| Delete any pipeline | ✅ | ❌ | ❌ |
| View users | ✅ | ❌ | ❌ |
| Create users | ✅ | ❌ | ❌ |
| Edit users | ✅ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| View all logs | ✅ | ❌ | ❌ |
| View own logs | ✅ | ✅ | ✅ |
| Export logs | ✅ | ✅ | ✅ |

## Best Practices

### For Administrators
1. **Use least privilege**: Assign minimal required role
2. **Regular audits**: Review activity logs periodically
3. **Deactivate unused accounts**: Don't delete immediately
4. **Document role changes**: Note reasons in external system
5. **Monitor admin accounts**: Watch for suspicious activity

### For Developers
1. **Always check permissions**: Use `usePermissions()` hook
2. **Log important actions**: Call `logActivity()` for user actions
3. **Handle read-only gracefully**: Disable UI elements, don't hide them
4. **Test all roles**: Verify behavior for each permission level
5. **Keep RLS policies synchronized**: Match UI restrictions with database

## Troubleshooting

### User can't log in
- Check if account is active in admin panel
- Verify email is correct
- Try password reset (if implemented)
- Check activity logs for failed attempts

### Permission denied errors
- Verify user role matches required permission
- Check RLS policies in database
- Confirm user is authenticated
- Check browser console for detailed errors

### Activity logs not appearing
- Verify `logActivity()` is called
- Check user is authenticated
- Confirm database connection
- Check RLS policies for activity_logs table

### Admin panel not accessible
- Verify user role is "admin"
- Check route protection in AppRouter
- Confirm admin link in sidebar (visible to admins only)
- Check browser console for routing errors

## Security Considerations

1. **Never bypass RLS**: All security enforced at database level
2. **Validate on backend**: Don't trust client-side checks alone
3. **Log sensitive operations**: Track all permission changes
4. **Regular backups**: Especially user_profiles and activity_logs
5. **Monitor failed logins**: Implement rate limiting if needed
6. **Secure environment variables**: Never commit credentials
7. **Use HTTPS**: Always in production
8. **Session timeout**: Configure appropriate timeout values

## Future Enhancements

Potential improvements for consideration:
- Password reset functionality
- Two-factor authentication (2FA)
- Email verification on signup
- More granular permissions (pipeline-level)
- Team/organization support
- API key management
- IP allowlisting
- Login attempt limiting
- Password complexity requirements
- Session management dashboard
- Bulk user operations
- Role templates
- Permission inheritance
- Custom roles

## Support

For issues or questions:
1. Check activity logs for detailed error information
2. Review RLS policies in Supabase dashboard
3. Verify environment variables are set correctly
4. Check browser console for client-side errors
5. Review Supabase Auth logs for authentication issues
