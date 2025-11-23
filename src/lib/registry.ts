const backendUrl = import.meta.env.VITE_BACKEND_URL;

type ConnectorKind = 'source' | 'sink';

interface ConnectorVersionPayload {
  name: string;
  kind: ConnectorKind;
  connectorClass: string;
  config: Record<string, unknown>;
  schemaKey?: string;
  schemaVersion?: string;
  ownerId?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}

async function registryRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!backendUrl) {
    throw new Error('Backend URL is not configured (missing VITE_BACKEND_URL)');
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body !== undefined && options.body !== null) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(`${backendUrl}${path}`, {
    headers,
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    let message = data.error || response.statusText || 'Registry request failed';
    if (Array.isArray(data.details) && data.details.length > 0) {
      console.error('Validation errors:', data.details);
      const detailText = data.details
        .map((err: any) => {
          const pathInfo = err.instancePath ? `${err.instancePath}: ` : '';
          return `${pathInfo}${err.message || JSON.stringify(err)}`;
        })
        .join('; ');
      message = `${message}: ${detailText}`;
    }
    throw new Error(message);
  }

  return data as T;
}

export async function createConnectorVersion(payload: ConnectorVersionPayload) {
  const { name, ...body } = payload;
  return registryRequest<{
    success: boolean;
    connector: any;
    version: { id: string; version: number; checksum: string };
    warnings?: string[];
  }>(`/api/registry/connectors/${encodeURIComponent(name)}/versions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function activateConnectorVersion(name: string, version: number) {
  return registryRequest(`/api/connectors/${encodeURIComponent(name)}/versions/${version}/activate`, {
    method: 'POST',
  });
}

export async function getConnectorVersions(name: string) {
  return registryRequest<{
    success: boolean;
    connector: any;
    versions: Array<{ id: string; version: number; is_active: boolean; config: Record<string, unknown>; checksum: string; created_at: string }>;
  }>(`/api/connectors/${encodeURIComponent(name)}/versions`);
}

export async function getActiveConnectorConfig(name: string, version?: number | null) {
  const data = await getConnectorVersions(name);
  let target;
  if (version && version > 0) {
    target = data.versions.find((v) => v.version === version);
  }
  if (!target) {
    target = data.versions.find((v) => v.is_active) || data.versions[0];
  }
  return target?.config || null;
}

export async function createDeployment(payload: {
  connectorName: string;
  version?: number;
  environment: string;
  connectClusterUrl: string;
  createdBy?: string | null;
}) {
  return registryRequest(`/api/registry/deployments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function applyDeployment(id: string) {
  return registryRequest(`/api/registry/deployments/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
  });
}

export async function markConnectorDeployed(name: string, version: number) {
  return registryRequest(`/api/registry/connectors/${encodeURIComponent(name)}/mark-deployed`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}
