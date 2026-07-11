import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { canUseAiFeatures } from "@/lib/constants";

/**
 * POST /api/admin/menu/generate-image
 * Generates a photorealistic dish image with OpenAI's image model and
 * uploads it to the `menu-images` Supabase Storage bucket. Locked to
 * restaurants on the 'pro' plan (or still inside their 7-day trial).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("restaurant_id, role").eq("id", user.id).maybeSingle();
  if (!profile?.restaurant_id || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, subscription_tier")
    .eq("id", profile.restaurant_id)
    .single();

  if (!restaurant || !canUseAiFeatures(restaurant.subscription_tier)) {
    return NextResponse.json(
      { error: "AI Menu Generator is available on the Pro plan (and during your free trial). Please upgrade." },
      { status: 403 }
    );
  }

  const { name, description, ingredients } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Dish name is required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI image generation is not configured on the server." }, { status: 503 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `Professional food photography of "${name}" for a restaurant menu.`,
      description ? `Description: ${description}.` : "",
      ingredients ? `Ingredients: ${ingredients}.` : "",
      "Top-down or 45-degree angle, on a clean plate, natural lighting, appetizing, high resolution, no text, no watermark.",
    ]
      .filter(Boolean)
      .join(" ");

    const generation = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
    });

    const b64 = generation.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from AI provider");

    const buffer = Buffer.from(b64, "base64");
    const path = `${restaurant.id}/ai-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from("menu-images").getPublicUrl(path);

    return NextResponse.json({ imageUrl: publicUrl.publicUrl });
  } catch (err: any) {
    console.error("AI image generation failed:", err?.message);
    return NextResponse.json({ error: "Failed to generate image. Please try again." }, { status: 500 });
  }
}
