import { ConnectionConfig, ValidationResult, DebeziumCheck } from '../types';

export const DEBEZIUM_CHECKS: Record<string, DebeziumCheck[]> = {
  oracle: [
    {
      name: 'Oracle Database Version',
      description: 'Oracle database version must be 11 or above',
      required: true,
    },
    {
      name: 'Database User Privileges',
      description: 'User must have SELECT ANY DICTIONARY and other required privileges',
      required: true,
    },
    {
      name: 'Redo Log Configuration',
      description: 'Redo logs must be properly configured for LogMiner',
      required: true,
    },
    {
      name: 'Archive Log Mode',
      description: 'Database must be in ARCHIVELOG mode for CDC',
      required: true,
    },
    {
      name: 'Supplemental Logging',
      description: 'Supplemental logging must be enabled at database and table level',
      required: true,
    },
  ],
  postgresql: [
    {
      name: 'WAL Level',
      description: 'Write-Ahead Logging must be set to logical',
      required: true,
    },
    {
      name: 'Max Replication Slots',
      description: 'At least one replication slot must be available',
      required: true,
    },
    {
      name: 'Max WAL Senders',
      description: 'At least one WAL sender must be available',
      required: true,
    },
    {
      name: 'Database User Replication Permission',
      description: 'User must have REPLICATION privilege',
      required: true,
    },
    {
      name: 'pgoutput Plugin',
      description: 'Logical decoding output plugin must be available',
      required: true,
    },
  ],
  sqlserver: [
    {
      name: 'SQL Server Version',
      description: 'SQL Server 2016 or later is required',
      required: true,
    },
    {
      name: 'CDC Enabled on Database',
      description: 'Change Data Capture must be enabled at database level',
      required: true,
    },
    {
      name: 'SQL Server Agent Running',
      description: 'SQL Server Agent service must be running',
      required: true,
    },
    {
      name: 'User Permissions',
      description: 'User must have db_owner or appropriate CDC permissions',
      required: true,
    },
  ],
};

export async function validateDebeziumPrerequisites(
  config: ConnectionConfig
): Promise<ValidationResult[]> {
  const checks = DEBEZIUM_CHECKS[config.db_type] || [];
  const results: ValidationResult[] = [];

  for (const check of checks) {
    const result = await simulateCheck(config, check);
    results.push({
      connection_id: config.id || '',
      check_name: check.name,
      status: result.status,
      message: result.message,
      details: result.details,
    });
  }

  return results;
}

async function simulateCheck(
  config: ConnectionConfig,
  check: DebeziumCheck
): Promise<{
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details: Record<string, unknown>;
}> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const random = Math.random();

  if (config.db_type === 'postgresql') {
    if (check.name === 'WAL Level') {
      if (random > 0.3) {
        return {
          status: 'passed',
          message: 'WAL level is set to logical',
          details: { current_value: 'logical', required_value: 'logical' },
        };
      } else {
        return {
          status: 'failed',
          message: 'WAL level is not set to logical. Current value: replica',
          details: {
            current_value: 'replica',
            required_value: 'logical',
            fix: 'Set wal_level = logical in postgresql.conf and restart',
          },
        };
      }
    }

    if (check.name === 'Max Replication Slots') {
      if (random > 0.2) {
        return {
          status: 'passed',
          message: 'Sufficient replication slots available',
          details: { max_replication_slots: 10, used_slots: 2 },
        };
      } else {
        return {
          status: 'warning',
          message: 'Low number of available replication slots',
          details: {
            max_replication_slots: 4,
            used_slots: 3,
            fix: 'Increase max_replication_slots in postgresql.conf',
          },
        };
      }
    }

    if (check.name === 'Database User Replication Permission') {
      if (random > 0.25) {
        return {
          status: 'passed',
          message: 'User has REPLICATION privilege',
          details: { username: config.username, has_replication: true },
        };
      } else {
        return {
          status: 'failed',
          message: 'User does not have REPLICATION privilege',
          details: {
            username: config.username,
            has_replication: false,
            fix: `GRANT REPLICATION ON DATABASE ${config.database_name} TO ${config.username};`,
          },
        };
      }
    }
  }

  if (config.db_type === 'oracle') {
    if (check.name === 'Oracle Database Version') {
      if (random > 0.2) {
        return {
          status: 'passed',
          message: 'Oracle database version is 19c (supported)',
          details: { version: '19c', minimum_required: '11g' },
        };
      } else {
        return {
          status: 'failed',
          message: 'Oracle database version is 10g (not supported)',
          details: {
            version: '10g',
            minimum_required: '11g',
            fix: 'Upgrade to Oracle 11g or higher',
          },
        };
      }
    }

    if (check.name === 'Archive Log Mode') {
      if (random > 0.3) {
        return {
          status: 'passed',
          message: 'Database is in ARCHIVELOG mode',
          details: { archivelog_mode: 'ENABLED' },
        };
      } else {
        return {
          status: 'failed',
          message: 'Database is not in ARCHIVELOG mode',
          details: {
            archivelog_mode: 'DISABLED',
            fix: 'Enable ARCHIVELOG mode using: SHUTDOWN IMMEDIATE; STARTUP MOUNT; ALTER DATABASE ARCHIVELOG; ALTER DATABASE OPEN;',
          },
        };
      }
    }

    if (check.name === 'Supplemental Logging') {
      if (random > 0.35) {
        return {
          status: 'passed',
          message: 'Supplemental logging is enabled',
          details: { supplemental_log_data_min: 'YES' },
        };
      } else {
        return {
          status: 'failed',
          message: 'Supplemental logging is not enabled',
          details: {
            supplemental_log_data_min: 'NO',
            fix: 'ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;',
          },
        };
      }
    }
  }

  if (config.db_type === 'sqlserver') {
    if (check.name === 'CDC Enabled on Database') {
      if (random > 0.3) {
        return {
          status: 'passed',
          message: 'Change Data Capture is enabled on the database',
          details: { cdc_enabled: true },
        };
      } else {
        return {
          status: 'failed',
          message: 'Change Data Capture is not enabled',
          details: {
            cdc_enabled: false,
            fix: `EXEC sys.sp_cdc_enable_db;`,
          },
        };
      }
    }

    if (check.name === 'SQL Server Agent Running') {
      if (random > 0.25) {
        return {
          status: 'passed',
          message: 'SQL Server Agent is running',
          details: { agent_status: 'Running' },
        };
      } else {
        return {
          status: 'failed',
          message: 'SQL Server Agent is not running',
          details: {
            agent_status: 'Stopped',
            fix: 'Start SQL Server Agent service from Services or SQL Server Configuration Manager',
          },
        };
      }
    }
  }

  if (random > 0.2) {
    return {
      status: 'passed',
      message: `${check.description} - Check passed`,
      details: { checked: true },
    };
  } else if (random > 0.1) {
    return {
      status: 'warning',
      message: `${check.description} - Configuration needs attention`,
      details: { checked: true, severity: 'low' },
    };
  } else {
    return {
      status: 'failed',
      message: `${check.description} - Check failed`,
      details: { checked: true, severity: 'high' },
    };
  }
}
