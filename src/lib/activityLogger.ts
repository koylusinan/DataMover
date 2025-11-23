import { supabase } from './supabase';

export interface LogActivityParams {
  actionType: string;
  actionDescription: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity({
  actionType,
  actionDescription,
  resourceType,
  resourceId,
  metadata = {},
}: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No user found for activity logging');
      return;
    }

    const { error } = await supabase
      .from('user_activity_logs')
      .insert({
        user_id: user.id,
        action_type: actionType,
        action_description: actionDescription,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        metadata: metadata || {},
        ip_address: null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
