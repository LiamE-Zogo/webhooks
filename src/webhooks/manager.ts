export function startWebhookWorkers(workerCount: number = 3) {
  console.log(`Starting ${workerCount} webhook workers...`);

  const workers: Worker[] = [];

  for (let i = 0; i < workerCount; i++) {
    const workerId = i + 1;

    try {
      // Create a new Web Worker
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
        name: `webhook-worker-${workerId}`,
      });

      // Handle worker messages
      worker.onmessage = (event) => {
        if (event.data.error) {
          console.error(`Worker ${workerId} error:`, event.data.error);
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        console.error(`Worker ${workerId} failed:`, error);
      };

      // Start the worker
      worker.postMessage({ workerId });

      workers.push(worker);
      console.log(`Webhook worker ${workerId} started`);
    } catch (error) {
      console.error(`Failed to start webhook worker ${workerId}:`, error);
    }
  }

  // Return workers array in case caller needs to manage them
  return workers;
}

export function stopWebhookWorkers(workers: Worker[]) {
  console.log(`Stopping ${workers.length} webhook workers...`);

  workers.forEach((worker, index) => {
    worker.terminate();
    console.log(`Webhook worker ${index + 1} stopped`);
  });
}
