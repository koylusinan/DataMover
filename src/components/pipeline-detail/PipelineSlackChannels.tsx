import { useState, useEffect } from 'react';
import { Plus, Trash2, Slack as SlackIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface SlackIntegration {
  id: string;
  channel_name: string;
  webhook_url: string;
  description?: string;
}

interface PipelineSlackChannel {
  id: string;
  slack_integration_id: string;
  slack_integrations: SlackIntegration;
}

interface PipelineSlackChannelsProps {
  pipelineId: string;
}

export function PipelineSlackChannels({ pipelineId }: PipelineSlackChannelsProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignedChannels, setAssignedChannels] = useState<PipelineSlackChannel[]>([]);
  const [availableWebhooks, setAvailableWebhooks] = useState<SlackIntegration[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [channelToRemove, setChannelToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    loadData();
  }, [pipelineId]);

  const loadData = async () => {
    await Promise.all([loadAssignedChannels(), loadAvailableWebhooks()]);
    setLoading(false);
  };

  const loadAssignedChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('pipeline_slack_channels')
        .select(`
          id,
          slack_integration_id,
          slack_integrations (
            id,
            channel_name,
            webhook_url,
            description
          )
        `)
        .eq('pipeline_id', pipelineId);

      if (error) throw error;

      setAssignedChannels(data || []);
    } catch (error) {
      console.error('Failed to load assigned channels:', error);
    }
  };

  const loadAvailableWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('slack_integrations')
        .select('*')
        .order('channel_name');

      if (error) throw error;

      setAvailableWebhooks(data || []);
    } catch (error) {
      console.error('Failed to load available webhooks:', error);
      setAvailableWebhooks([]);
    }
  };

  const handleAddChannel = async () => {
    if (!selectedWebhookId) {
      showToast('error', 'Please select a Slack channel');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('pipeline_slack_channels')
        .insert({
          pipeline_id: pipelineId,
          slack_integration_id: selectedWebhookId,
        });

      if (error) {
        if (error.code === '23505') {
          showToast('error', 'This Slack channel is already assigned');
        } else {
          throw error;
        }
        return;
      }

      showToast('success', 'Slack channel assigned successfully');
      setShowAddModal(false);
      setSelectedWebhookId('');
      loadAssignedChannels();
    } catch (error) {
      console.error('Failed to assign channel:', error);
      showToast('error', 'Failed to assign Slack channel');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveChannel = async () => {
    if (!channelToRemove) return;

    setRemoving(true);
    try {
      const { error } = await supabase
        .from('pipeline_slack_channels')
        .delete()
        .eq('id', channelToRemove.id);

      if (error) throw error;

      showToast('success', 'Slack channel removed');
      setShowRemoveModal(false);
      setChannelToRemove(null);
      loadAssignedChannels();
    } catch (error) {
      console.error('Failed to remove channel:', error);
      showToast('error', 'Failed to remove Slack channel');
    } finally {
      setRemoving(false);
    }
  };

  const getUnassignedWebhooks = () => {
    const assignedIds = new Set(assignedChannels.map(c => c.slack_integration_id));
    return availableWebhooks.filter(w => !assignedIds.has(w.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <SlackIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Slack Channels
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {assignedChannels.length} channel{assignedChannels.length !== 1 ? 's' : ''}
        </span>
      </div>

      {assignedChannels.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <SlackIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">No Slack channels assigned</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            Assign Slack channels to receive alerts for this pipeline
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={availableWebhooks.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign Slack Channel
          </button>
          {availableWebhooks.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              No Slack webhooks available. Add webhooks in Admin → Alert Settings → Slack Integrations
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {assignedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <SlackIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {channel.slack_integrations.channel_name}
                      </h4>
                      {channel.slack_integrations.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {channel.slack_integrations.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setChannelToRemove({ id: channel.id, name: channel.slack_integrations.channel_name });
                      setShowRemoveModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {getUnassignedWebhooks().length > 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Another Channel
            </button>
          )}
        </>
      )}

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <SlackIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Assign Slack Channel
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                All alerts for this pipeline will be sent to assigned channels
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Slack Channel
              </label>
              <select
                value={selectedWebhookId}
                onChange={(e) => setSelectedWebhookId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select a channel --</option>
                {getUnassignedWebhooks().map((webhook) => (
                  <option key={webhook.id} value={webhook.id}>
                    {webhook.channel_name}
                    {webhook.description && ` - ${webhook.description}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedWebhookId('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddChannel}
                disabled={adding || !selectedWebhookId}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Assign Channel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Channel Confirmation Modal */}
      {showRemoveModal && channelToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                Remove Slack Channel
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to remove <span className="font-semibold text-gray-900 dark:text-gray-100">"{channelToRemove.name}"</span> from this pipeline?
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This channel will no longer receive alerts for this pipeline. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setChannelToRemove(null);
                }}
                disabled={removing}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveChannel}
                disabled={removing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {removing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove Channel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
