-- Fix RLS policies for alert_preferences table

-- SELECT policy: Users can view their own preferences
CREATE POLICY "Users can view their own alert preferences"
ON alert_preferences
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_preferences.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);

-- INSERT policy: Users can create preferences for themselves
CREATE POLICY "Users can insert their own alert preferences"
ON alert_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_preferences.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);

-- UPDATE policy: Users can update their own preferences
CREATE POLICY "Users can update their own alert preferences"
ON alert_preferences
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_preferences.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_preferences.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);

-- DELETE policy: Users can delete their own preferences
CREATE POLICY "Users can delete their own alert preferences"
ON alert_preferences
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR
  has_role_level('admin') OR
  EXISTS (
    SELECT 1 FROM pipelines
    WHERE pipelines.id = alert_preferences.pipeline_id
    AND pipelines.user_id = auth.uid()
  )
);
