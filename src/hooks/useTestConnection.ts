import { useState } from 'react';

export interface TestConnectionRequest {
  connectionType: 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'mongodb';
  host: string;
  port: number;
  database?: string;
  serviceName?: string;
  schemaName?: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message?: string;
  error?: string;
  version?: any;
  suggestion?: string;
}

export function useTestConnection() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectionResponse | null>(null);

  const testConnection = async (config: TestConnectionRequest): Promise<TestConnectionResponse> => {
    setTesting(true);
    setResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const backendUrl = import.meta.env.VITE_BACKEND_URL;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing');
      }

      const isOracle = config.connectionType === 'oracle';

      let response: Response;
      if (isOracle) {
        if (!backendUrl) {
          throw new Error('Backend URL is missing. Please set VITE_BACKEND_URL in your .env file.');
        }

        const payload = {
          ...config,
          serviceName: config.serviceName || config.database,
        };

        response = await fetch(`${backendUrl}/api/test-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${supabaseUrl}/functions/v1/test-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(config),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TestConnectionResponse = await response.json();
      setResult(data);
      return data;
    } catch (error) {
      const errorResult: TestConnectionResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setTesting(false);
    }
  };

  return {
    testConnection,
    testing,
    result,
  };
}
