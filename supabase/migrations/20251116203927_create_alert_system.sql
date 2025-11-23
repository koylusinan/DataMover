/*
  # Alert System Schema

  1. New Tables
    - `alert_recipients`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `email` (text)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references user_profiles)
    
    - `alert_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles, unique)
      - `pipeline_connectivity_slack` (boolean, default false)
      - `pipeline_connectivity_email` (boolean, default false)
      - `pipeline_connectivity_dashboard` (boolean, default false)
      - `pipeline_job_failures_slack` (boolean, default false)
      - `pipeline_job_failures_email` (boolean, default false)
      - `pipeline_job_failures_dashboard` (boolean, default false)
      - `source_event_types_slack` (boolean, default false)
      - `source_event_types_email` (boolean, default false)
      - `source_event_types_dashboard` (boolean, default false)
      - `failed_events_summary_slack` (boolean, default false)
      - `failed_events_summary_email` (boolean, default false)
      - `failed_events_summary_dashboard` (boolean, default false)
      - `webhooks_slack` (boolean, default false)
      - `webhooks_email` (boolean, default false)
      - `webhooks_dashboard` (boolean, default false)
      - `pipeline_loading_status_slack` (boolean, default false)
      - `pipeline_loading_status_email` (boolean, default false)
      - `pipeline_loading_status_dashboard` (boolean, default false)
      - `source_side_events_slack` (boolean, default false)
      - `source_side_events_email` (boolean, default false)
      - `source_side_events_dashboard` (boolean, default false)
      - `data_spike_alert_slack` (boolean, default false)
      - `data_spike_alert_email` (boolean, default false)
      - `data_spike_alert_dashboard` (boolean, default false)
      - `updated_at` (timestamptz, default now())
    
    - `slack_integrations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `workspace_name` (text)
      - `webhook_url` (text)
      - `channel` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for admin-only access
*/

-- Alert Recipients Table
CREATE TABLE IF NOT EXISTS alert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL
);

ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all alert recipients"
  ON alert_recipients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert alert recipients"
  ON alert_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete alert recipients"
  ON alert_recipients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Alert Preferences Table
CREATE TABLE IF NOT EXISTS alert_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  pipeline_connectivity_slack boolean DEFAULT false,
  pipeline_connectivity_email boolean DEFAULT false,
  pipeline_connectivity_dashboard boolean DEFAULT false,
  pipeline_job_failures_slack boolean DEFAULT false,
  pipeline_job_failures_email boolean DEFAULT false,
  pipeline_job_failures_dashboard boolean DEFAULT false,
  source_event_types_slack boolean DEFAULT false,
  source_event_types_email boolean DEFAULT false,
  source_event_types_dashboard boolean DEFAULT false,
  failed_events_summary_slack boolean DEFAULT false,
  failed_events_summary_email boolean DEFAULT false,
  failed_events_summary_dashboard boolean DEFAULT false,
  webhooks_slack boolean DEFAULT false,
  webhooks_email boolean DEFAULT false,
  webhooks_dashboard boolean DEFAULT false,
  pipeline_loading_status_slack boolean DEFAULT false,
  pipeline_loading_status_email boolean DEFAULT false,
  pipeline_loading_status_dashboard boolean DEFAULT false,
  source_side_events_slack boolean DEFAULT false,
  source_side_events_email boolean DEFAULT false,
  source_side_events_dashboard boolean DEFAULT false,
  data_spike_alert_slack boolean DEFAULT false,
  data_spike_alert_email boolean DEFAULT false,
  data_spike_alert_dashboard boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert preferences"
  ON alert_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all alert preferences"
  ON alert_preferences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own alert preferences"
  ON alert_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update all alert preferences"
  ON alert_preferences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own alert preferences"
  ON alert_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert all alert preferences"
  ON alert_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Slack Integrations Table
CREATE TABLE IF NOT EXISTS slack_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_name text NOT NULL,
  webhook_url text NOT NULL,
  channel text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own slack integrations"
  ON slack_integrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all slack integrations"
  ON slack_integrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can manage own slack integrations"
  ON slack_integrations FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all slack integrations"
  ON slack_integrations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );