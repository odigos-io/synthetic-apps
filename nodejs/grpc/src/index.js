const path = require("path");
const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const httpPort = Number(process.env.PORT || 8080);
const grpcPort = Number(process.env.GRPC_PORT || 50051);
const grpcPeerAddress =
  process.env.GRPC_PEER_ADDRESS || "127.0.0.1:" + grpcPort;
const clientIntervalMs = Number(process.env.GRPC_CLIENT_INTERVAL_MS || 10000);
const startupDelayMs = Number(process.env.STARTUP_DELAY_MS || 3000);

const enableServer = process.env.GRPC_ENABLE_SERVER !== "false";
const enableClient = process.env.GRPC_ENABLE_CLIENT === "true";
const enableRelay = process.env.GRPC_ENABLE_RELAY === "true";
const includeStreamInClient =
  process.env.GRPC_CLIENT_INCLUDE_STREAM !== "false";

let ready = false;
let startupError = null;
let lastClientError = null;
let lastClientCallAt = null;
let clientCallCount = 0;
let grpcServer = null;
let clientIntervalTimer = null;

const protoPath = path.join(__dirname, "..", "proto", "synthetic.proto");
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const syntheticProto = grpc.loadPackageDefinition(packageDefinition).synthetic;

function createClient(address) {
  return new syntheticProto.SyntheticService(
    address,
    grpc.credentials.createInsecure()
  );
}

function unaryPromise(client, message) {
  return new Promise((resolve, reject) => {
    client.Unary({ message }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function streamNumbersPromise(client, count) {
  return new Promise((resolve, reject) => {
    const call = client.StreamNumbers({ count });
    const items = [];
    call.on("data", (item) => items.push(item));
    call.on("error", reject);
    call.on("end", () => resolve(items));
  });
}

function clientStreamSumPromise(client, count) {
  return new Promise((resolve, reject) => {
    const call = client.ClientStreamSum((err, summary) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(summary);
    });
    for (let i = 1; i <= count; i += 1) {
      call.write({ sequence: i, payload: "client-stream-" + i });
    }
    call.end();
  });
}

function bidiEchoPromise(client, count) {
  return new Promise((resolve, reject) => {
    const call = client.BidiEcho();
    const received = [];
    call.on("data", (item) => received.push(item));
    call.on("error", reject);
    call.on("end", () => resolve(received));
    for (let i = 1; i <= count; i += 1) {
      call.write({ sequence: i, payload: "bidi-" + i });
    }
    call.end();
  });
}

function relayPromise(client, message) {
  return new Promise((resolve, reject) => {
    client.Relay({ message }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function buildServiceHandlers(peerAddress) {
  return {
    Unary: (call, callback) => {
      const inbound = call.request.message || "";
      callback(null, {
        message: "unary-ok:" + inbound,
        timestamp_ms: Date.now(),
      });
    },

    Relay: (call, callback) => {
      const inbound = call.request.message || "";
      const client = createClient(peerAddress);
      unaryPromise(client, "relay-outbound:" + inbound)
        .then((outbound) => {
          callback(null, {
            inbound_message: inbound,
            outbound_message: outbound.message,
            timestamp_ms: Date.now(),
          });
        })
        .catch((err) => {
          callback({
            code: grpc.status.INTERNAL,
            message: "relay outbound failed: " + err.message,
          });
        })
        .finally(() => {
          client.close();
        });
    },

    StreamNumbers: (call) => {
      const count = Math.max(1, Math.min(Number(call.request.count) || 5, 20));
      let seq = 1;
      const timer = setInterval(() => {
        if (call.cancelled) {
          clearInterval(timer);
          return;
        }
        call.write({
          sequence: seq,
          payload: "stream-number-" + seq,
        });
        if (seq >= count) {
          clearInterval(timer);
          call.end();
        }
        seq += 1;
      }, 50);
      call.on("cancelled", () => clearInterval(timer));
    },

    ClientStreamSum: (call, callback) => {
      let receivedCount = 0;
      let sum = 0;
      call.on("data", (item) => {
        receivedCount += 1;
        sum += Number(item.sequence) || 0;
      });
      call.on("end", () => {
        callback(null, { received_count: receivedCount, sum });
      });
      call.on("error", (err) => callback(err));
    },

    BidiEcho: (call) => {
      call.on("data", (item) => {
        call.write({
          sequence: item.sequence,
          payload: "echo:" + (item.payload || ""),
        });
      });
      call.on("end", () => call.end());
      call.on("error", () => call.end());
    },
  };
}

function startGrpcServer() {
  const handlers = buildServiceHandlers(grpcPeerAddress);
  if (!enableRelay) {
    delete handlers.Relay;
  }

  grpcServer = new grpc.Server();
  grpcServer.addService(
    syntheticProto.SyntheticService.service,
    handlers
  );
  return new Promise((resolve, reject) => {
    grpcServer.bindAsync(
      "0.0.0.0:" + grpcPort,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          reject(err);
          return;
        }
        console.log("gRPC server listening on 0.0.0.0:" + port);
        resolve();
      }
    );
  });
}

async function fireClientCalls() {
  const client = createClient(grpcPeerAddress);
  try {
    const unary = await unaryPromise(
      client,
      "interval-" + new Date().toISOString()
    );
    console.log("[grpc-client] unary ok:", unary.message);

    if (includeStreamInClient) {
      const streamed = await streamNumbersPromise(client, 3);
      console.log(
        "[grpc-client] stream ok: items=" + streamed.length
      );

      const clientStream = await clientStreamSumPromise(client, 3);
      console.log(
        "[grpc-client] client-stream ok: count=" +
          clientStream.received_count +
          " sum=" +
          clientStream.sum
      );

      const bidi = await bidiEchoPromise(client, 2);
      console.log("[grpc-client] bidi ok: items=" + bidi.length);
    }

    lastClientCallAt = new Date().toISOString();
    clientCallCount += 1;
    lastClientError = null;
  } catch (err) {
    lastClientError = err;
    console.error("[grpc-client] call failed:", err.message);
  } finally {
    client.close();
  }
}

function startGrpcClientLoop() {
  const tick = () => {
    fireClientCalls().catch((err) => {
      lastClientError = err;
      console.error("[grpc-client] unexpected error", err);
    });
  };
  console.log(
    "grpc client interval every " +
      clientIntervalMs +
      "ms → " +
      grpcPeerAddress
  );
  setTimeout(tick, startupDelayMs);
  clientIntervalTimer = setInterval(tick, clientIntervalMs);
}

const app = express();

app.get("/healthz", (_req, res) => {
  if (!ready || startupError) {
    return res.status(503).json({
      status: "not ready",
      ready,
      enableServer,
      enableClient,
      enableRelay,
      grpcPeerAddress,
      error: startupError ? String(startupError.message || startupError) : null,
    });
  }
  res.json({
    status: "ok",
    enableServer,
    enableClient,
    enableRelay,
    grpcPort,
    grpcPeerAddress,
    lastClientCallAt,
    clientCallCount,
    lastClientError: lastClientError
      ? String(lastClientError.message || lastClientError)
      : null,
  });
});

async function run() {
  if (enableServer) {
    await startGrpcServer();
  }
  await new Promise((r) => setTimeout(r, startupDelayMs));
  if (enableClient) {
    startGrpcClientLoop();
  }
  ready = true;
}

app.listen(httpPort, () => {
  console.log("HTTP health listening on " + httpPort);
});

run().catch((err) => {
  startupError = err;
  console.error("startup error", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  if (clientIntervalTimer) {
    clearInterval(clientIntervalTimer);
    clientIntervalTimer = null;
  }
  if (grpcServer) {
    grpcServer.tryShutdown(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
    return;
  }
  process.exit(0);
});
