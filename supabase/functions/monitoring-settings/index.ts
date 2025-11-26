import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Reuse client across requests
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: { persistSession: false },
        db: { schema: 'public' }
      }
    );
  }
  return supabaseClient;
}

interface MonitoringSettings {
  id: string;
  lag_ms: number;
  throughput_drop_percent: number;
  error_rate_percent: number;
  dlq_count: number;
  check_interval_ms: number;
  pause_duration_seconds: number;
  backup_retention_hours: number;
  updated_at: string;
  updated_by?: string;
}

const DEFAULT_SETTINGS: Omit<MonitoringSettings, 'id' | 'updated_at'> = {
  lag_ms: 5000,
  throughput_drop_percent: 50,
  error_rate_percent: 1,
  dlq_count: 0,
  check_interval_ms: 60000,
  pause_duration_seconds: 5,
  backup_retention_hours: 24,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const method = req.method;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      userId = user?.id || null;
    }

    // GET - Fetch monitoring settings
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('monitoring_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Return defaults if no settings exist
      if (!data) {
        return jsonResponse({
          ...DEFAULT_SETTINGS,
          id: null,
          updated_at: null
        });
      }

      return jsonResponse(data);
    }

    // PUT - Update monitoring settings
    if (method === 'PUT') {
      const body = await req.json();

      // Validate fields
      const allowedFields = [
        'lag_ms',
        'throughput_drop_percent',
        'error_rate_percent',
        'dlq_count',
        'check_interval_ms',
        'pause_duration_seconds',
        'backup_retention_hours'
      ];

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (userId) {
        updateData.updated_by = userId;
      }

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          // Validate numeric values
          const value = Number(body[field]);
          if (isNaN(value) || value < 0) {
            return jsonResponse({ error: `Invalid value for ${field}` }, 400);
          }
          updateData[field] = value;
        }
      }

      // Check if settings exist
      const { data: existing } = await supabase
        .from('monitoring_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let result;

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('monitoring_settings')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('monitoring_settings')
          .insert({
            ...DEFAULT_SETTINGS,
            ...updateData
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);

  } catch (error) {
    console.error('Monitoring settings error:', error);
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
