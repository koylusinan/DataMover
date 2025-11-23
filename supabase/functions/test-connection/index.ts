import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestConnectionRequest {
  connectionType: 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'mongodb';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: TestConnectionRequest = await req.json();

    const result = await testDatabaseConnection(body);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function testDatabaseConnection(config: TestConnectionRequest) {
  const { connectionType, host, port, database, username, password, ssl } = config;

  switch (connectionType) {
    case "postgresql":
      return await testPostgreSQL(host, port, database, username, password, ssl);
    case "mysql":
      return await testMySQL(host, port, database, username, password, ssl);
    case "oracle":
      return await testOracle(host, port, database, username, password);
    case "sqlserver":
      return await testSQLServer(host, port, database, username, password);
    case "mongodb":
      return await testMongoDB(host, port, database, username, password);
    default:
      throw new Error(`Unsupported connection type: ${connectionType}`);
  }
}

async function testPostgreSQL(
  host: string,
  port: number,
  database: string,
  username: string,
  password: string,
  ssl?: boolean
) {
  try {
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");

    const resolvedHost = normalizeHostForContainer(host);

    const client = new Client({
      user: username,
      password: password,
      database: database,
      hostname: resolvedHost,
      port: port,
      tls: ssl ? { enabled: true } : undefined,
    });

    await client.connect();
    
    const result = await client.queryObject("SELECT version()");
    
    await client.end();

    return {
      success: true,
      message: "PostgreSQL connection successful",
      version: result.rows[0],
    };
  } catch (error) {
    return {
      success: false,
      error: `PostgreSQL connection failed: ${error.message}`,
    };
  }
}

async function testMySQL(
  host: string,
  port: number,
  database: string,
  username: string,
  password: string,
  ssl?: boolean
) {
  try {
    const { Client } = await import("https://deno.land/x/mysql@v2.12.1/mod.ts");
    
    const resolvedHost = normalizeHostForContainer(host);

    const client = await new Client().connect({
      hostname: resolvedHost,
      port: port,
      username: username,
      password: password,
      db: database,
    });

    const result = await client.query("SELECT VERSION() as version");
    
    await client.close();

    return {
      success: true,
      message: "MySQL connection successful",
      version: result[0],
    };
  } catch (error) {
    return {
      success: false,
      error: `MySQL connection failed: ${error.message}`,
    };
  }
}

async function testOracle(
  host: string,
  port: number,
  database: string,
  username: string,
  password: string
) {
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();

    return {
      success: true,
      message: "Oracle host is reachable on specified port",
      suggestion: "TCP connection successful. Full Oracle authentication will be handled by Debezium connector.",
    };
  } catch (error) {
    return {
      success: false,
      error: `Cannot reach Oracle host: ${error.message}`,
      suggestion: "Check if the host and port are correct, and ensure the database is accessible from this network.",
    };
  }
}

async function testSQLServer(
  host: string,
  port: number,
  database: string,
  username: string,
  password: string
) {
  return {
    success: false,
    error: "SQL Server direct connection not yet implemented.",
    suggestion: "Consider using a connection proxy or JDBC bridge for SQL Server databases.",
  };
}

async function testMongoDB(
  host: string,
  port: number,
  database: string,
  username: string,
  password: string
) {
  try {
    const { MongoClient } = await import("npm:mongodb@6.3.0");

    const resolvedHost = normalizeHostForContainer(host);

    const uri = `mongodb://${username}:${password}@${resolvedHost}:${port}/${database}`;
    const client = new MongoClient(uri);

    await client.connect();
    
    const admin = client.db().admin();
    const info = await admin.serverInfo();
    
    await client.close();

    return {
      success: true,
      message: "MongoDB connection successful",
      version: info.version,
    };
  } catch (error) {
    return {
      success: false,
      error: `MongoDB connection failed: ${error.message}`,
    };
  }
}

function normalizeHostForContainer(host: string) {
  if (!host) return host;
  const trimmed = host.trim().toLowerCase();
  const localAliases = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

  if (localAliases.has(trimmed)) {
    return Deno.env.get("LOCALHOST_OVERRIDE_HOST") || "host.docker.internal";
  }

  return host;
}
