-- Fix RLS policies for alert_recipients table
-- Problem: Only SELECT policy exists, INSERT/UPDATE/DELETE policies are missing

-- INSERT policy: Authenticated users can add recipients for pipelines they own
CREATE POLICY "Users can insert alert recipients"
ON alert_recipients
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_recipients.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);

-- UPDATE policy: Users can update their own recipients or pipeline owners
CREATE POLICY "Users can update alert recipients"
ON alert_recipients
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  created_by = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_recipients.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_recipients.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);

-- DELETE policy: Users can delete their own recipients or pipeline owners
CREATE POLICY "Users can delete alert recipients"
ON alert_recipients
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR
  created_by = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_recipients.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);
