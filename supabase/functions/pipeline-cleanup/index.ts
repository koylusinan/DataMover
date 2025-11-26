import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

interface CleanupResult {
  pipeline_id: string;
  pipeline_name: string;
  deleted_at: string;
  retention_hours: number;
  status: 'deleted' | 'error';
  error?: string;
}

/**
 * Pipeline Cleanup Edge Function
 *
 * Deletes pipelines that have been soft-deleted and exceeded their retention period.
 *
 * Can be triggered:
 * 1. Via HTTP POST (manual trigger)
 * 2. Via pg_cron scheduled job
 * 3. Via Supabase scheduled functions
 *
 * Usage:
 * POST /pipeline-cleanup
 * Body (optional): { "dry_run": true } - Preview what would be deleted
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const startTime = Date.now();
  const results: CleanupResult[] = [];

  try {
    const supabase = getSupabaseClient();

    // Parse body for options
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
    } catch {
      // No body or invalid JSON, continue with defaults
    }

    console.log(`[Pipeline Cleanup] Starting ${dryRun ? '(DRY RUN)' : ''}...`);

    // Find expired pipelines
    // Pipelines with deleted_at set and past their retention period
    const { data: expiredPipelines, error: queryError } = await supabase
      .from('pipelines')
      .select(`
        id,
        name,
        deleted_at,
        backup_retention_hours
      `)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: true });

    if (queryError) throw queryError;

    if (!expiredPipelines || expiredPipelines.length === 0) {
      console.log('[Pipeline Cleanup] No soft-deleted pipelines found');
      return jsonResponse({
        success: true,
        dry_run: dryRun,
        checked: 0,
        deleted: 0,
        results: [],
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`[Pipeline Cleanup] Found ${expiredPipelines.length} soft-deleted pipeline(s)`);

    const now = new Date();

    for (const pipeline of expiredPipelines) {
      const deletedAt = new Date(pipeline.deleted_at);
      const retentionHours = pipeline.backup_retention_hours || 24;
      const expirationTime = new Date(deletedAt.getTime() + retentionHours * 60 * 60 * 1000);

      // Check if retention period has passed
      if (now < expirationTime) {
        console.log(`[Pipeline Cleanup] ${pipeline.name} - Not yet expired (expires: ${expirationTime.toISOString()})`);
        continue;
      }

      console.log(`[Pipeline Cleanup] ${pipeline.name} - Expired, ${dryRun ? 'would delete' : 'deleting'}...`);

      if (dryRun) {
        results.push({
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          deleted_at: pipeline.deleted_at,
          retention_hours: retentionHours,
          status: 'deleted'
        });
        continue;
      }

      try {
        // Delete related records first (respecting foreign key constraints)
        // Order matters due to FK dependencies

        // 1. Delete pipeline tasks (depends on pipeline_table_objects)
        await supabase
          .from('pipeline_tasks')
          .delete()
          .in('table_object_id',
            supabase
              .from('pipeline_table_objects')
              .select('id')
              .eq('pipeline_id', pipeline.id)
          );

        // 2. Delete pipeline table objects
        await supabase
          .from('pipeline_table_objects')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 3. Delete pipeline restore staging
        await supabase
          .from('pipeline_restore_staging')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 4. Delete pipeline connectors
        await supabase
          .from('pipeline_connectors')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 5. Delete pipeline objects
        await supabase
          .from('pipeline_objects')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 6. Delete pipeline logs
        await supabase
          .from('pipeline_logs')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 7. Delete pipeline progress events
        await supabase
          .from('pipeline_progress_events')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 8. Delete pipeline slack channels
        await supabase
          .from('pipeline_slack_channels')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 9. Delete alert events
        await supabase
          .from('alert_events')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 10. Delete alert preferences
        await supabase
          .from('alert_preferences')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 11. Delete alert recipients
        await supabase
          .from('alert_recipients')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 12. Delete mapping configs
        await supabase
          .from('mapping_configs')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 13. Delete job runs
        await supabase
          .from('job_runs')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 14. Delete precheck results
        await supabase
          .from('precheck_results')
          .delete()
          .eq('pipeline_id', pipeline.id);

        // 15. Finally, delete the pipeline itself
        const { error: deleteError } = await supabase
          .from('pipelines')
          .delete()
          .eq('id', pipeline.id);

        if (deleteError) throw deleteError;

        console.log(`[Pipeline Cleanup] Successfully deleted: ${pipeline.name}`);

        results.push({
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          deleted_at: pipeline.deleted_at,
          retention_hours: retentionHours,
          status: 'deleted'
        });

      } catch (error) {
        console.error(`[Pipeline Cleanup] Error deleting ${pipeline.name}:`, error);
        results.push({
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          deleted_at: pipeline.deleted_at,
          retention_hours: retentionHours,
          status: 'error',
          error: error.message
        });
      }
    }

    const deletedCount = results.filter(r => r.status === 'deleted').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`[Pipeline Cleanup] Completed: ${deletedCount} deleted, ${errorCount} errors`);

    return jsonResponse({
      success: errorCount === 0,
      dry_run: dryRun,
      checked: expiredPipelines.length,
      deleted: deletedCount,
      errors: errorCount,
      results,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('[Pipeline Cleanup] Fatal error:', error);
    return jsonResponse(
      {
        success: false,
        error: error.message || 'Internal server error',
        results,
        duration_ms: Date.now() - startTime
      },
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
