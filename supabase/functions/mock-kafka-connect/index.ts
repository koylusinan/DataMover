import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConnectorConfig {
  name: string;
  config: Record<string, any>;
}

const connectors = new Map<string, ConnectorConfig>();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // GET / - Root endpoint
    if (path === "/mock-kafka-connect" && req.method === "GET") {
      return new Response(
        JSON.stringify({
          version: "7.7.0-mock",
          commit: "mock-simulated",
          kafka_cluster_id: "mock-cluster",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // GET /connectors - List all connectors
    if (path === "/mock-kafka-connect/connectors" && req.method === "GET") {
      return new Response(
        JSON.stringify(Array.from(connectors.keys())),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // POST /connectors - Create connector
    if (path === "/mock-kafka-connect/connectors" && req.method === "POST") {
      const body: ConnectorConfig = await req.json();
      
      if (!body.name || !body.config) {
        return new Response(
          JSON.stringify({ error: "Invalid connector config" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      connectors.set(body.name, body);

      return new Response(
        JSON.stringify({
          name: body.name,
          config: body.config,
          tasks: [],
          type: body.config["connector.class"]?.includes("Source") ? "source" : "sink",
        }),
        {
          status: 201,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // GET /connectors/:name - Get connector info
    if (path.startsWith("/mock-kafka-connect/connectors/") && req.method === "GET") {
      const parts = path.split("/");
      const name = parts[3];

      if (!name) {
        return new Response(
          JSON.stringify({ error: "Connector name required" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Check if path ends with /status
      if (parts[4] === "status") {
        const connector = connectors.get(name);
        if (!connector) {
          return new Response(
            JSON.stringify({ error: "Connector not found" }),
            {
              status: 404,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            name: name,
            connector: {
              state: "RUNNING",
              worker_id: "mock-worker:8083",
            },
            tasks: [
              {
                id: 0,
                state: "RUNNING",
                worker_id: "mock-worker:8083",
              },
            ],
            type: connector.config["connector.class"]?.includes("Source") ? "source" : "sink",
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const connector = connectors.get(name);
      if (!connector) {
        return new Response(
          JSON.stringify({ error: "Connector not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          name: connector.name,
          config: connector.config,
          tasks: [{ connector: name, task: 0 }],
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // PUT /connectors/:name/pause - Pause connector
    if (path.includes("/pause") && req.method === "PUT") {
      const name = path.split("/")[3];
      if (!connectors.has(name)) {
        return new Response(
          JSON.stringify({ error: "Connector not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ message: "Paused connector " + name }),
        {
          status: 202,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // PUT /connectors/:name/resume - Resume connector
    if (path.includes("/resume") && req.method === "PUT") {
      const name = path.split("/")[3];
      if (!connectors.has(name)) {
        return new Response(
          JSON.stringify({ error: "Connector not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ message: "Resumed connector " + name }),
        {
          status: 202,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // DELETE /connectors/:name - Delete connector
    if (path.startsWith("/mock-kafka-connect/connectors/") && req.method === "DELETE") {
      const name = path.split("/")[3];
      
      if (!connectors.has(name)) {
        return new Response(
          JSON.stringify({ error: "Connector not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      connectors.delete(name);

      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 404 for unknown endpoints
    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
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