import { config } from "dotenv";
import { streamText } from "ai";

// Load local secrets (AI Gateway API key and/or Vercel OIDC token)
config({ path: ".env.local" });

async function main() {
  const result = streamText({
    model: "openai/gpt-5.4",
    prompt: "Invent a new holiday and describe its traditions in 3 short sentences.",
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log("Token usage:", await result.usage);
  console.log("Finish reason:", await result.finishReason);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
