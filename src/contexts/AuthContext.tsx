import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

export type UserRole = 'admin' | 'maintainer' | 'read_only';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  hasRole: (role: UserRole) => boolean;
  hasRoleLevel: (minimumRole: UserRole) => boolean;
  logActivity: (actionType: string, description: string, resourceType?: string, resourceId?: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      console.log('Profile fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const createProfile = async (userId: string, email: string, fullName?: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email,
          full_name: fullName || null,
          role: 'read_only',
          is_active: true,
          last_login_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // If profile already exists (duplicate key error), fetch it instead
        if (error.code === '23505') {
          console.log('Profile already exists, fetching...');
          return await fetchProfile(userId);
        }
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  };

  const updateLastLogin = async (userId: string) => {
    try {
      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then(async (profileData) => {
          if (!profileData) {
            const newProfile = await createProfile(
              session.user.id,
              session.user.email || '',
              session.user.user_metadata?.full_name
            );
            setProfile(newProfile);
          } else {
            setProfile(profileData);
            await updateLastLogin(session.user.id);
          }
          setLoading(false);
        }).catch((error) => {
          console.error('Error in profile flow:', error);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then(async (profileData) => {
          if (!profileData) {
            const newProfile = await createProfile(
              session.user.id,
              session.user.email || '',
              session.user.user_metadata?.full_name
            );
            setProfile(newProfile);
          } else {
            setProfile(profileData);
            await updateLastLogin(session.user.id);
          }
        }).catch((error) => {
          console.error('Error in profile flow:', error);
        });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showToast('error', 'Login failed: ' + error.message);
        return { error };
      }

      if (data.user) {
        const profileData = await fetchProfile(data.user.id);

        if (!profileData?.is_active) {
          await supabase.auth.signOut();
          showToast('error', 'Your account has been deactivated');
          return { error: new AuthError('Account deactivated') };
        }

        await logActivity('auth.login', 'User logged in');
        showToast('success', 'Successfully logged in');
      }

      return { error: null };
    } catch (error) {
      showToast('error', 'An error occurred during login');
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        showToast('error', 'Sign up failed: ' + error.message);
        return { error };
      }

      if (data.user) {
        await createProfile(data.user.id, email, fullName);
        showToast('success', 'Account created successfully');
      }

      return { error: null };
    } catch (error) {
      showToast('error', 'An error occurred during sign up');
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      await logActivity('auth.logout', 'User logged out');
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      showToast('success', 'Logged out successfully');
    } catch (error) {
      showToast('error', 'Error logging out');
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }

      await logActivity('profile.update', 'User updated profile', 'user_profile', user.id);
      showToast('success', 'Profile updated successfully');
      return { error: null };
    } catch (error) {
      showToast('error', 'Error updating profile');
      return { error: error as Error };
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return profile?.role === role && profile?.is_active === true;
  };

  const hasRoleLevel = (minimumRole: UserRole): boolean => {
    if (!profile?.is_active) return false;

    const roleHierarchy: Record<UserRole, number> = {
      read_only: 1,
      maintainer: 2,
      admin: 3,
    };

    const userLevel = roleHierarchy[profile.role];
    const requiredLevel = roleHierarchy[minimumRole];

    return userLevel >= requiredLevel;
  };

  const logActivity = async (
    actionType: string,
    description: string,
    resourceType?: string,
    resourceId?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return;

    try {
      await supabase.from('user_activity_logs').insert({
        user_id: user.id,
        action_type: actionType,
        action_description: description,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        metadata: metadata || {},
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    hasRole,
    hasRoleLevel,
    logActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
