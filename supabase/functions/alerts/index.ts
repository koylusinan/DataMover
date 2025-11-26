import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Reuse client across requests (warm starts)
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

interface AlertEvent {
  id: string;
  pipeline_id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // Auth check (optional - remove if public access needed)
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    // GET /alerts - List all alerts
    if (method === 'GET' && pathParts[pathParts.length - 1] === 'alerts') {
      const pipelineId = url.searchParams.get('pipeline_id');
      const resolved = url.searchParams.get('resolved');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('alert_events')
        .select('*, pipelines(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }
      if (resolved !== null) {
        query = query.eq('resolved', resolved === 'true');
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return jsonResponse({ alerts: data, total: count });
    }

    // GET /alerts/stats - Alert statistics
    if (method === 'GET' && pathParts.includes('stats')) {
      const { data: total } = await supabase
        .from('alert_events')
        .select('id', { count: 'exact', head: true });

      const { data: unresolved } = await supabase
        .from('alert_events')
        .select('id', { count: 'exact', head: true })
        .eq('resolved', false);

      const { data: bySeverity } = await supabase
        .from('alert_events')
        .select('severity')
        .eq('resolved', false);

      const severityCounts = (bySeverity || []).reduce((acc: Record<string, number>, item) => {
        acc[item.severity] = (acc[item.severity] || 0) + 1;
        return acc;
      }, {});

      const { data: byType } = await supabase
        .from('alert_events')
        .select('alert_type')
        .eq('resolved', false);

      const typeCounts = (byType || []).reduce((acc: Record<string, number>, item) => {
        acc[item.alert_type] = (acc[item.alert_type] || 0) + 1;
        return acc;
      }, {});

      return jsonResponse({
        total: total?.length || 0,
        unresolved: unresolved?.length || 0,
        by_severity: severityCounts,
        by_type: typeCounts
      });
    }

    // GET /alerts/:id - Get single alert
    if (method === 'GET' && pathParts.length >= 2) {
      const alertId = pathParts[pathParts.length - 1];
      if (alertId !== 'alerts' && alertId !== 'stats') {
        const { data, error } = await supabase
          .from('alert_events')
          .select('*, pipelines(name)')
          .eq('id', alertId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return jsonResponse({ error: 'Alert not found' }, 404);
        }

        return jsonResponse(data);
      }
    }

    // POST /alerts - Create alert
    if (method === 'POST' && pathParts[pathParts.length - 1] === 'alerts') {
      const body = await req.json();
      const { pipeline_id, alert_type, severity, message, metadata } = body;

      if (!pipeline_id || !alert_type || !severity || !message) {
        return jsonResponse({ error: 'Missing required fields' }, 400);
      }

      const { data, error } = await supabase
        .from('alert_events')
        .insert({
          pipeline_id,
          alert_type,
          severity,
          message,
          metadata: metadata || {},
          resolved: false
        })
        .select()
        .single();

      if (error) throw error;

      return jsonResponse(data, 201);
    }

    // POST /alerts/:id/resolve - Resolve single alert
    if (method === 'POST' && pathParts.includes('resolve')) {
      const alertId = pathParts[pathParts.indexOf('resolve') - 1];

      const { data, error } = await supabase
        .from('alert_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      return jsonResponse(data);
    }

    // POST /pipelines/:id/alerts/resolve-all - Resolve all pipeline alerts
    if (method === 'POST' && pathParts.includes('resolve-all')) {
      const pipelineIdx = pathParts.indexOf('pipelines') + 1;
      const pipelineId = pathParts[pipelineIdx];

      const { data, error } = await supabase
        .from('alert_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('pipeline_id', pipelineId)
        .eq('resolved', false)
        .select();

      if (error) throw error;

      return jsonResponse({ resolved_count: data?.length || 0 });
    }

    return jsonResponse({ error: 'Not found' }, 404);

  } catch (error) {
    console.error('Alert function error:', error);
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
