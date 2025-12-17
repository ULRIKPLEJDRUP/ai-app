import { runAgent } from "./agent.js";

runAgent().catch((err) => {
  console.error("❌ Agent crashed:", err);
  process.exit(1);
});
