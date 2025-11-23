export async function applyDeployment(pool, deploymentId, logger) {
  const client = await pool.connect();
  let deploymentRow;
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `select d.*, cv.config, cv.checksum, c.name as connector_name, c.class as connector_class
       from deployments d
       join connector_versions cv on d.connector_version_id = cv.id
       join connectors c on cv.connector_id = c.id
       where d.id = $1`,
      [deploymentId]
    );
    if (res.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new Error('Deployment not found');
    }
    deploymentRow = res.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    throw error;
  }
  client.release();

  const baseUrl = deploymentRow.connect_cluster_url.replace(/\/$/, '');
  const connectorName = deploymentRow.connector_name;
  const config = ensureConnectorName(deploymentRow.config, connectorName);

  try {
    const exists = await fetch(`${baseUrl}/connectors/${encodeURIComponent(connectorName)}`);
    if (exists.status === 200) {
      await putConfig(baseUrl, connectorName, config);
    } else if (exists.status === 404) {
      await createConnector(baseUrl, connectorName, config);
    } else {
      throw new Error(`Unexpected Connect response: ${exists.status}`);
    }
    await updateDeploymentStatus(pool, deploymentId, 'deployed', 'Applied to Kafka Connect', logger);
  } catch (error) {
    logger.error({ err: error }, 'Deployment failed');
    await updateDeploymentStatus(pool, deploymentId, 'error', error.message, logger);
    throw error;
  }
}

async function putConfig(baseUrl, connectorName, config) {
  const resp = await fetch(`${baseUrl}/connectors/${encodeURIComponent(connectorName)}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to update connector: ${resp.status} ${text}`);
  }
}

async function createConnector(baseUrl, connectorName, config) {
  const resp = await fetch(`${baseUrl}/connectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: connectorName, config }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create connector: ${resp.status} ${text}`);
  }
}

async function updateDeploymentStatus(pool, deploymentId, status, statusMsg, logger) {
  const client = await pool.connect();
  try {
    await client.query(
      `update deployments
       set status = $2,
           status_msg = $3,
           deployed_at = case when $2 = 'deployed' then now() else deployed_at end
       where id = $1`,
      [deploymentId, status, statusMsg]
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to update deployment status');
  } finally {
    client.release();
  }
}

function ensureConnectorName(config, connectorName) {
  if (config.name && config.name === connectorName) {
    return config;
  }
  return { ...config, name: connectorName };
}
