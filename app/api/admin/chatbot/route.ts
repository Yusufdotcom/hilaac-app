import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { buildChatbotTools } from "@/lib/chatbot/build-tools";
import { buildChatbotSystemPrompt } from "@/lib/chatbot/system-prompt";
import { getVerifiedReportsContext } from "@/lib/reports/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const MODEL = process.env.HILAAC_CHATBOT_MODEL || "openai/gpt-4.1-mini";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: string;
      messages?: ChatMessage[];
    };
    const slug = body.slug?.trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!slug) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (messages.length === 0) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    if (messages.length > 40) {
      return NextResponse.json({ error: "Conversation too long" }, { status: 400 });
    }

    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || !String(last.content || "").trim()) {
      return NextResponse.json({ error: "User message required" }, { status: 400 });
    }

    const ctx = await getVerifiedReportsContext(slug);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const aal = await requireAal2ForPrivilegedRole(ctx.supabase, ctx.profile.role);
    if (!aal.ok) return aal.response;

    if (!ctx.restaurant.id || ctx.restaurant.slug !== slug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canUseFeature(ctx.restaurant.subscription_tier, "ai_chatbot")) {
      return NextResponse.json(
        {
          error: "Galeyr 1.0 exclusive",
          code: "tier_gated",
          gated: true,
        },
        { status: 403 }
      );
    }

    const tools = buildChatbotTools(ctx.supabase, ctx.restaurant.id);
    const toolsUsed: { name: string; input: unknown }[] = [];

    const result = await generateText({
      model: MODEL,
      system: buildChatbotSystemPrompt(ctx.restaurant.name),
      messages: messages.map((m) => ({
        role: m.role,
        content: String(m.content).slice(0, 4000),
      })),
      tools,
      stopWhen: stepCountIs(6),
      onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls ?? []) {
          toolsUsed.push({
            name: call.toolName,
            input: "input" in call ? call.input : undefined,
          });
          console.info("[chatbot] tool", {
            restaurantId: ctx.restaurant.id,
            tool: call.toolName,
            input: "input" in call ? call.input : undefined,
          });
        }
      },
    });

    const reply =
      result.text?.trim() ||
      "I looked up your data but could not form an answer. Try asking about today’s sales, top items, or inventory.";

    return NextResponse.json({
      reply,
      toolsUsed,
      restaurantId: ctx.restaurant.id,
    });
  } catch (err) {
    console.error("[chatbot] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chatbot failed" },
      { status: 500 }
    );
  }
}
