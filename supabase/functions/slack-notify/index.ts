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

type Severity = 'info' | 'warning' | 'critical' | 'success';

const SEVERITY_CONFIG: Record<Severity, { color: string; emoji: string }> = {
  info: { color: '#2196F3', emoji: ':information_source:' },
  warning: { color: '#FF9800', emoji: ':warning:' },
  critical: { color: '#F44336', emoji: ':rotating_light:' },
  success: { color: '#4CAF50', emoji: ':white_check_mark:' },
};

interface SlackPayload {
  pipelineId?: string;
  message: string;
  severity?: Severity;
  title?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  webhookUrl?: string; // Direct webhook URL (optional)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = getSupabaseClient();
    const body: SlackPayload = await req.json();

    const {
      pipelineId,
      message,
      severity = 'info',
      title,
      fields = [],
      webhookUrl: directWebhookUrl
    } = body;

    if (!message) {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    // Get webhook URLs
    const webhookUrls: string[] = [];

    if (directWebhookUrl) {
      webhookUrls.push(directWebhookUrl);
    } else if (pipelineId) {
      // Get webhooks linked to this pipeline
      const { data: pipelineChannels } = await supabase
        .from('pipeline_slack_channels')
        .select(`
          slack_integration_id,
          slack_integrations (
            webhook_url,
            is_active,
            channel_name
          )
        `)
        .eq('pipeline_id', pipelineId);

      if (pipelineChannels) {
        for (const channel of pipelineChannels) {
          const integration = channel.slack_integrations as any;
          if (integration?.is_active && integration?.webhook_url) {
            webhookUrls.push(integration.webhook_url);
          }
        }
      }

      // If no pipeline-specific channels, get default webhooks
      if (webhookUrls.length === 0) {
        const { data: defaultIntegrations } = await supabase
          .from('slack_integrations')
          .select('webhook_url')
          .eq('is_active', true)
          .limit(1);

        if (defaultIntegrations?.[0]?.webhook_url) {
          webhookUrls.push(defaultIntegrations[0].webhook_url);
        }
      }
    }

    if (webhookUrls.length === 0) {
      return jsonResponse({
        success: false,
        error: 'No active Slack webhooks found'
      }, 404);
    }

    // Get pipeline name if pipelineId provided
    let pipelineName = '';
    if (pipelineId) {
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('name')
        .eq('id', pipelineId)
        .maybeSingle();
      pipelineName = pipeline?.name || pipelineId;
    }

    // Build Slack message
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;

    const slackMessage = {
      attachments: [
        {
          color: config.color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${config.emoji} ${title || 'DataMove Alert'}`,
                emoji: true
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message
              }
            },
            ...(pipelineName ? [{
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Pipeline:* ${pipelineName}`
                }
              ]
            }] : []),
            ...(fields.length > 0 ? [{
              type: 'section',
              fields: fields.map(f => ({
                type: 'mrkdwn',
                text: `*${f.title}*\n${f.value}`
              }))
            }] : []),
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `_Sent at ${new Date().toISOString()}_`
                }
              ]
            }
          ]
        }
      ]
    };

    // Send to all webhooks in parallel
    const results = await Promise.allSettled(
      webhookUrls.map(async (webhookUrl) => {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Slack API error: ${response.status} - ${text}`);
        }

        return { webhookUrl, success: true };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return jsonResponse({
      success: successful > 0,
      sent: successful,
      failed,
      total: webhookUrls.length
    });

  } catch (error) {
    console.error('Slack notify error:', error);
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
