export interface ConnectionConfig {
  id?: string;
  user_id?: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ValidationResult {
  id?: string;
  connection_id: string;
  check_name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  checked_at?: string;
}

export interface DebeziumCheck {
  name: string;
  description: string;
  required: boolean;
}

export type UserRole = 'admin' | 'maintainer' | 'read_only';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SearchResult {
  id: string;
  type: 'pipeline' | 'source_connector' | 'destination_connector';
  title: string;
  subtitle?: string;
  pipelineId?: string;
  connectorClass?: string;
  pipelineName?: string;
}
