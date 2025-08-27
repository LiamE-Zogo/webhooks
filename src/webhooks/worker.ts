/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import Database from "../db/index.ts";
import { startWebhookSender } from "./sender.ts";

// This file runs in a Web Worker
self.onmessage = async (event: MessageEvent) => {
  const { workerId } = event.data;

  console.log(`Webhook worker ${workerId} starting...`);

  try {
    // Initialize database connection for this worker
    // Each worker needs its own database instance since workers are isolated
    // Use smaller pool size for workers (3 connections vs 20 for main thread)
    const database = new Database();
    await database.initialize(3);
    
    if (database.client) {
      await startWebhookSender(database.client);
    } else {
      throw new Error("Failed to initialize database client");
    }
  } catch (error) {
    console.error(`Webhook worker ${workerId} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({ error: errorMessage });
  }
};
