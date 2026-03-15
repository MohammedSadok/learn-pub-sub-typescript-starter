import amqp from "amqplib";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { publishJSON } from "../internal/pubsub/publishjson.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  const ch = await conn.createConfirmChannel();
  console.log("Peril game server connected to RabbitMQ!");

  printServerHelp();

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await ch.close();
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  // Interactive loop for server commands
  while (true) {
    const words = await getInput();
    if (words.length === 0) {
      continue;
    }

    const command = words[0];

    if (command === "pause") {
      console.log("Sending pause message...");
      const pausedState: PlayingState = { isPaused: true };
      await publishJSON(ch, ExchangePerilDirect, PauseKey, pausedState);
    } else if (command === "resume") {
      console.log("Sending resume message...");
      const resumedState: PlayingState = { isPaused: false };
      await publishJSON(ch, ExchangePerilDirect, PauseKey, resumedState);
    } else if (command === "quit") {
      console.log("Exiting server...");
      break;
    } else if (command === "help") {
      printServerHelp();
    } else {
      console.log(`Unknown command: ${command}`);
    }
  }

  try {
    await ch.close();
    await conn.close();
    console.log("RabbitMQ connection closed.");
  } catch (err) {
    console.error("Error closing RabbitMQ connection:", err);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
