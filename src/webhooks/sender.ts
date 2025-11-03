import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

async function sendCallbackNotification(
  webhook: Webhook,
  finalStatus: "success" | "error",
  runLogData: {
    response_text: string;
    response_code: number;
    response_time: number;
  }
) {
  if (!webhook.callback_url) {
    return; // No callback URL provided
  }

  try {
    const callbackData = {
      webhook_id: webhook.id,
      original_url: webhook.send_url,
      final_status: finalStatus,
      attempt_count: webhook.attempt_count,
      last_response: runLogData,
    };

    await fetch(webhook.callback_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callbackData),
    });

    console.log(`Callback notification sent for webhook ${webhook.id}`);
  } catch (error) {
    console.error(
      `Failed to send callback notification for webhook ${webhook.id}:`,
      error
    );
  }
}

interface Webhook {
  id: number;
  send_url: string;
  attempt_count: number;
  next_attempt_time: Date;
  data: object | null;
  status: "available" | "processing" | "error" | "success";
  processing_id: string | null;
  callback_url: string | null;
}

export async function startWebhookSender(dbClient: Client) {
  console.log("Starting webhook sender...");

  while (true) {
    try {
      // Use a unique processing identifier to claim a specific webhook
      const processingId = `proc_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`;

      // First, try to find an available webhook
      const availableWebhooks = (await dbClient.query(
        `
        SELECT id FROM webhooks 
        WHERE status = 'available' 
        AND next_attempt_time <= NOW() 
        ORDER BY next_attempt_time 
        LIMIT 5
      `
      )) as { id: number }[];

      if (availableWebhooks.length === 0) {
        // No webhooks available, wait 100ms and try again
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      // Try to claim one of the available webhooks
      let claimedWebhook = null;
      for (const webhook of availableWebhooks) {
        try {
          const result = await dbClient.execute(
            `
            UPDATE webhooks 
            SET status = 'processing',
                processing_id = ?
            WHERE id = ? 
            AND status = 'available'
          `,
            [processingId, webhook.id]
          );

          const affectedRows = (result as { affectedRows: number })
            .affectedRows;
          if (affectedRows > 0) {
            claimedWebhook = webhook;
            break;
          }
        } catch (_error) {
          // If this specific webhook causes a deadlock, try the next one
          console.log(`Failed to claim webhook ${webhook.id}, trying next...`);
          continue;
        }
      }

      if (!claimedWebhook) {
        // Couldn't claim any webhook, wait and try again
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      // Get the specific webhook we claimed using our processing ID
      const webhooks = (await dbClient.query(
        `
        SELECT * FROM webhooks 
        WHERE status = 'processing' 
        AND processing_id = ?
      `,
        [processingId]
      )) as Webhook[];

      if (webhooks.length === 0) {
        // This shouldn't happen, but handle it gracefully
        console.error("Failed to retrieve claimed webhook");
        continue;
      }

      const webhook = webhooks[0];
      console.log(`Processing webhook ${webhook.id} to ${webhook.send_url}`);

      try {
        // Send the POST request
        const requestOptions: RequestInit = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        };

        // Only include body if there's data to send
        if (webhook.data !== null && webhook.data !== undefined) {
          requestOptions.body = JSON.stringify(webhook.data);
        }

        const startTime = Date.now();
        const response = await fetch(webhook.send_url, requestOptions);
        const responseTime = Date.now() - startTime;
        const responseText = await response.text();

        console.log(responseText);

        // Log the attempt to run_log
        await dbClient.execute(
          `
          INSERT INTO run_log (webhook_id, response_text, response_code, response_time) 
          VALUES (?, ?, ?, ?)
        `,
          [webhook.id, responseText, response.status, responseTime]
        );

        if (response.ok) {
          // Success - mark as completed and clear processing_id
          await dbClient.execute(
            `
            UPDATE webhooks 
            SET status = 'success',
                processing_id = NULL
            WHERE id = ?
          `,
            [webhook.id]
          );

          // Send callback notification for successful webhook
          await sendCallbackNotification(webhook, "success", {
            response_text: responseText,
            response_code: response.status,
            response_time: responseTime,
          });

          console.log(`Webhook ${webhook.id} sent successfully`);
        } else {
          // HTTP error - handle as failure
          await handleWebhookFailure(
            dbClient,
            webhook,
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            responseTime
          );
        }
      } catch (error) {
        // Network or other error
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await handleWebhookFailure(dbClient, webhook, errorMessage, 0, 0);
      }
    } catch (error) {
      console.error("Error in webhook sender:", error);
      // Wait a bit before retrying to avoid tight error loops
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function handleWebhookFailure(
  dbClient: Client,
  webhook: Webhook,
  errorText: string,
  errorCode: number,
  responseTime: number
) {
  console.log(`Webhook ${webhook.id} failed: ${errorText}`);

  const newAttemptCount = webhook.attempt_count + 1;

  // Calculate next attempt time using logarithmic backoff
  // Base delay of 1 minute, multiplied by log(attempt_count + 1)
  const baseDelayMinutes = 1;
  const backoffMultiplier = newAttemptCount / 2;
  const delayMinutes = Math.ceil((backoffMultiplier ^ 2) * baseDelayMinutes);

  // Log the failed attempt to run_log
  await dbClient.execute(
    `
    INSERT INTO run_log (webhook_id, response_text, response_code, response_time) 
    VALUES (?, ?, ?, ?)
  `,
    [webhook.id, errorText, errorCode, responseTime]
  );

  if (newAttemptCount >= 20) {
    // Max attempts reached - mark as error and clear processing_id
    await dbClient.execute(
      `
      UPDATE webhooks 
      SET status = 'error', 
          attempt_count = ?,
          processing_id = NULL
      WHERE id = ?
    `,
      [newAttemptCount, webhook.id]
    );

    // Send callback notification for failed webhook
    await sendCallbackNotification(webhook, "error", {
      response_text: errorText,
      response_code: errorCode,
      response_time: responseTime,
    });

    console.log(
      `Webhook ${webhook.id} marked as error after ${newAttemptCount} attempts`
    );
  } else {
    // Return to available with incremented attempt count and delayed next attempt time
    await dbClient.execute(
      `
      UPDATE webhooks 
      SET status = 'available', 
          attempt_count = ?, 
          next_attempt_time = DATE_ADD(NOW(), INTERVAL ? MINUTE),
          processing_id = NULL
      WHERE id = ?
    `,
      [newAttemptCount, delayMinutes, webhook.id]
    );

    console.log(
      `Webhook ${webhook.id} will retry in ${delayMinutes} minutes (attempt ${newAttemptCount})`
    );
  }
}
