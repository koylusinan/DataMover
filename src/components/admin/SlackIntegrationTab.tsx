import { useState, useEffect } from 'react';
import { Plus, Trash2, Send, Check, AlertTriangle, Loader2, Slack as SlackIcon, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface SlackWebhook {
  id: string;
  channel_name: string;
  webhook_url: string;
  description?: string;
  created_at: string;
  workspace_name: string;
  user_id: string;
  pipeline_count?: number;
  assigned_pipelines?: Pipeline[];
}

interface Pipeline {
  id: string;
  name: string;
  status?: string;
}

export function SlackIntegrationTab() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [slackWebhooks, setSlackWebhooks] = useState<SlackWebhook[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [slackName, setSlackName] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackDescription, setSlackDescription] = useState('');
  const [selectedPipelineIds, setSelectedPipelineIds] = useState<Set<string>>(new Set());
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testingNewWebhook, setTestingNewWebhook] = useState(false);
  const [savingSlack, setSavingSlack] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; webhookId: string | null; webhookName: string }>({
    isOpen: false,
    webhookId: null,
    webhookName: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadSlackWebhooks(), loadPipelines()]);
  };

  const loadSlackWebhooks = async () => {
    try {
      const { data: webhooksData, error: webhooksError } = await supabase
        .from('slack_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (webhooksError) throw webhooksError;

      // Load pipeline counts and details for each webhook
      const webhooksWithCounts = await Promise.all(
        (webhooksData || []).map(async (webhook) => {
          const { data: pipelineData, error: pipelineError } = await supabase
            .from('pipeline_slack_channels')
            .select('pipeline_id, pipelines(id, name, status)')
            .eq('slack_webhook_id', webhook.id);

          const assigned_pipelines = pipelineError
            ? []
            : pipelineData?.map((item: any) => item.pipelines).filter(Boolean) || [];

          return {
            ...webhook,
            pipeline_count: assigned_pipelines.length,
            assigned_pipelines,
          };
        })
      );

      setSlackWebhooks(webhooksWithCounts);
    } catch (error) {
      console.error('Failed to load Slack webhooks:', error);
      showToast('error', 'Failed to load Slack webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, status')
        .order('name');

      if (error) throw error;

      setPipelines(data || []);
    } catch (error) {
      console.error('Failed to load pipelines:', error);
    }
  };

  const handleAddWebhook = async () => {
    if (!slackName.trim() || !slackWebhookUrl.trim()) {
      showToast('error', 'Please fill in required fields');
      return;
    }

    setSavingSlack(true);
    try {
      // Insert the webhook
      const { data: webhookData, error: webhookError } = await supabase
        .from('slack_integrations')
        .insert({
          channel_name: slackName.trim(),
          webhook_url: slackWebhookUrl.trim(),
          description: slackDescription.trim() || null,
          user_id: user?.id,
          workspace_name: 'Default Workspace',
        })
        .select()
        .single();

      if (webhookError) throw webhookError;

      // If pipelines are selected, create the assignments
      if (selectedPipelineIds.size > 0) {
        const assignments = Array.from(selectedPipelineIds).map(pipelineId => ({
          pipeline_id: pipelineId,
          slack_webhook_id: webhookData.id,
        }));

        const { error: assignError } = await supabase
          .from('pipeline_slack_channels')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      const pipelineCount = selectedPipelineIds.size;
      const successMessage = pipelineCount > 0
        ? `Slack webhook added and assigned to ${pipelineCount} pipeline${pipelineCount !== 1 ? 's' : ''}`
        : 'Slack webhook added successfully';

      showToast('success', successMessage);
      setShowAddModal(false);
      resetForm();
      loadSlackWebhooks();
    } catch (error) {
      console.error('Failed to add Slack webhook:', error);
      showToast('error', 'Failed to add Slack webhook');
    } finally {
      setSavingSlack(false);
    }
  };

  const handleDeleteWebhook = (id: string, name: string) => {
    setDeleteModal({ isOpen: true, webhookId: id, webhookName: name });
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteModal.webhookId) return;

    try {
      const { error } = await supabase
        .from('slack_integrations')
        .delete()
        .eq('id', deleteModal.webhookId);

      if (error) throw error;

      showToast('success', 'Slack webhook deleted');
      setDeleteModal({ isOpen: false, webhookId: null, webhookName: '' });
      loadSlackWebhooks();
    } catch (error) {
      console.error('Failed to delete Slack webhook:', error);
      showToast('error', 'Failed to delete Slack webhook');
    }
  };

  const handleTestWebhook = async (webhook: SlackWebhook) => {
    setTestingWebhook(webhook.id);

    try {
      // Get all pipelines for this webhook
      const { data: assignedPipelines, error } = await supabase
        .from('pipeline_slack_channels')
        .select(`
          pipeline_id,
          pipelines (
            id,
            name,
            status
          )
        `)
        .eq('slack_webhook_id', webhook.id);

      if (error) {
        console.error('Error fetching assigned pipelines:', error);
      }

      const pipelinesData = assignedPipelines?.map(ap => ap.pipelines).filter(Boolean) || [];

      const message = pipelinesData.length > 0
        ? createPipelineStatusMessage(pipelinesData as Pipeline[])
        : {
            text: `📊 CDCStream Pipeline Status Report`,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: '📊 Pipeline Status Report',
                  emoji: true
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Webhook:* ${webhook.channel_name}\n*Status:* No pipelines assigned to this webhook`
                }
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: '📡 Generated by CDCStream Monitoring System'
                  }
                ]
              }
            ]
          };

      // Send via backend to avoid CORS
      const response = await fetch('http://localhost:5002/api/slack/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: webhook.webhook_url,
          message
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Test message sent successfully');
      } else {
        showToast('error', result.error || 'Failed to send test message');
      }
    } catch (error) {
      console.error('Failed to test webhook:', error);
      showToast('error', 'Failed to send test message');
    } finally {
      setTestingWebhook(null);
    }
  };

  const resetForm = () => {
    setSlackName('');
    setSlackWebhookUrl('');
    setSlackDescription('');
    setSelectedPipelineIds(new Set());
  };

  const createPipelineStatusMessage = (selectedPipelines: Pipeline[]) => {
    const statusEmoji = (status: string) => {
      switch (status) {
        case 'running': return '🟢';
        case 'ready': return '🔵';
        case 'paused': return '⏸️';
        case 'error': return '🔴';
        case 'idle': return '⚪';
        case 'seeding': return '🌱';
        case 'incremental': return '♻️';
        case 'draft': return '📝';
        default: return '⚫';
      }
    };

    const statusColor = (status: string) => {
      switch (status) {
        case 'running': return '#36a64f';
        case 'ready': return '#2196F3';
        case 'paused': return '#FF9800';
        case 'error': return '#d32f2f';
        case 'seeding': return '#4CAF50';
        case 'incremental': return '#00BCD4';
        default: return '#757575';
      }
    };

    const runningCount = selectedPipelines.filter(p => p.status === 'running').length;
    const pausedCount = selectedPipelines.filter(p => p.status === 'paused').length;
    const errorCount = selectedPipelines.filter(p => p.status === 'error').length;
    const readyCount = selectedPipelines.filter(p => p.status === 'ready').length;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 CDCStream Pipeline Status Report',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Pipelines*\n${selectedPipelines.length}`
          },
          {
            type: 'mrkdwn',
            text: `*Report Time*\n${new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}`
          },
          {
            type: 'mrkdwn',
            text: `*Running*\n🟢 ${runningCount}`
          },
          {
            type: 'mrkdwn',
            text: `*Issues*\n${errorCount > 0 ? '🔴' : '✅'} ${errorCount}`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    // Group pipelines by status
    const groupedPipelines = selectedPipelines.reduce((acc, pipeline) => {
      const status = pipeline.status || 'unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(pipeline);
      return acc;
    }, {} as Record<string, Pipeline[]>);

    // Add pipelines grouped by status
    Object.entries(groupedPipelines).forEach(([status, pipes]) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${statusEmoji(status)} ${status.toUpperCase()} (${pipes.length})*\n${pipes.map(p => `• ${p.name}`).join('\n')}`
        }
      });
    });

    blocks.push(
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⚡ *CDCStream* | Real-time Data Pipeline Monitoring'
          }
        ]
      }
    );

    return {
      text: `Pipeline Status Report: ${selectedPipelines.length} pipelines - ${runningCount} running, ${errorCount} errors`,
      blocks,
      attachments: errorCount > 0 ? [{
        color: '#d32f2f',
        text: `⚠️ ${errorCount} pipeline${errorCount !== 1 ? 's' : ''} require${errorCount === 1 ? 's' : ''} attention`
      }] : []
    };
  };

  const handleTestNewWebhook = async () => {
    if (!slackWebhookUrl.trim()) {
      showToast('error', 'Please enter a webhook URL');
      return;
    }

    if (selectedPipelineIds.size === 0) {
      showToast('error', 'Please select at least one pipeline to test');
      return;
    }

    setTestingNewWebhook(true);
    try {
      // Get selected pipelines data
      const selectedPipelines = pipelines.filter(p => selectedPipelineIds.has(p.id));
      const message = createPipelineStatusMessage(selectedPipelines);

      // Send via backend to avoid CORS
      const response = await fetch('http://localhost:5002/api/slack/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: slackWebhookUrl.trim(),
          message
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast('success', `Test message sent successfully for ${selectedPipelines.length} pipeline(s)`);
      } else {
        showToast('error', result.error || 'Failed to send test message');
      }
    } catch (error) {
      console.error('Failed to test webhook:', error);
      showToast('error', 'Failed to send test message');
    } finally {
      setTestingNewWebhook(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <SlackIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Slack Integrations
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure Slack webhooks for alert notifications
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>

        <div className="p-6">
          {slackWebhooks.length === 0 ? (
            <div className="text-center py-12">
              <SlackIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">No Slack webhooks configured</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Webhook
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {slackWebhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {webhook.channel_name}
                        </h4>
                        {webhook.pipeline_count !== undefined && webhook.pipeline_count > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {webhook.pipeline_count} pipeline{webhook.pipeline_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {webhook.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {webhook.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                        {webhook.webhook_url}
                      </p>
                      {webhook.assigned_pipelines && webhook.assigned_pipelines.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Assigned to Pipelines:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {webhook.assigned_pipelines.map((pipeline) => (
                              <span
                                key={pipeline.id}
                                className="inline-flex items-center px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                              >
                                {pipeline.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Added {new Date(webhook.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleTestWebhook(webhook)}
                        disabled={testingWebhook === webhook.id}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {testingWebhook === webhook.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Test
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id, webhook.channel_name)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Slack Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <SlackIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Add Slack Webhook
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure a new Slack webhook for alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={slackName}
                  onChange={(e) => setSlackName(e.target.value)}
                  placeholder="e.g., Engineering Alerts"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={slackDescription}
                  onChange={(e) => setSlackDescription(e.target.value)}
                  placeholder="e.g., Used for critical pipeline alerts"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign to Pipelines (Optional)
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 max-h-60 overflow-y-auto">
                  {pipelines.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No pipelines available
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {pipelines.map((pipeline) => (
                        <label
                          key={pipeline.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPipelineIds.has(pipeline.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPipelineIds);
                              if (e.target.checked) {
                                newSet.add(pipeline.id);
                              } else {
                                newSet.delete(pipeline.id);
                              }
                              setSelectedPipelineIds(newSet);
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                            {pipeline.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPipelineIds.size > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {selectedPipelineIds.size} pipeline{selectedPipelineIds.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <button
                onClick={handleTestNewWebhook}
                disabled={testingNewWebhook || !slackWebhookUrl.trim() || selectedPipelineIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testingNewWebhook ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Test
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWebhook}
                  disabled={savingSlack || !slackName.trim() || !slackWebhookUrl.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingSlack ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Add Webhook
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setDeleteModal({ isOpen: false, webhookId: null, webhookName: '' })} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full relative">
              <button
                onClick={() => setDeleteModal({ isOpen: false, webhookId: null, webhookName: '' })}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600 dark:text-red-500" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 text-center">
                  Delete Slack Integration?
                </h2>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
                  Are you sure you want to delete <span className="font-semibold">"{deleteModal.webhookName}"</span>?
                </p>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                  This action cannot be undone.
                </p>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setDeleteModal({ isOpen: false, webhookId: null, webhookName: '' })}
                    className="px-6 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteWebhook}
                    className="px-6 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-lg hover:bg-red-700 transition-all border-2 border-red-600 hover:border-red-700 shadow-md hover:shadow-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
