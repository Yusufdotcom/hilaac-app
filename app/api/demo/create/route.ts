import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEMO_BURGER_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop";

const DEMO_BURGER_PROMPT =
  "A delicious, juicy cheeseburger with lettuce, tomato, and melted cheese on a wooden table, professional food photography, bright lighting, 4K, appetizing, menu quality.";

async function generateDemoBurgerImageUrl(): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return DEMO_BURGER_FALLBACK_IMAGE;
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: DEMO_BURGER_PROMPT,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("demo/create DALL-E error:", response.status, errText);
    return DEMO_BURGER_FALLBACK_IMAGE;
  }

  const data = (await response.json()) as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) {
    console.error("demo/create DALL-E: no image URL returned");
    return DEMO_BURGER_FALLBACK_IMAGE;
  }

  return url;
}

function errorResponse(message: string, status = 500, details?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export async function POST() {
  const supabase = createClient();
  const admin = createAdminClient();

  try {
    await supabase.auth.signOut();

    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    let userId = authData.user?.id;

    if (authError || !userId) {
      const email = `demo-${crypto.randomUUID().slice(0, 8)}@demo.hilaac.local`;
      const password = crypto.randomUUID();

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Demo User", is_demo: true },
      });

      if (createError || !created.user) {
        return errorResponse(
          "Could not create a demo session.",
          500,
          createError?.message ?? authError?.message
        );
      }

      userId = created.user.id;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        return errorResponse("Could not sign in to the demo session.", 500, signInError.message);
      }
    }

    const slug = `demo-${Date.now()}`;
    const demoExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Demo restaurants do not require owner_id — access is via profiles.restaurant_id.
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        name: "Hilaac Demo Restaurant",
        slug,
        owner_id: null,
        is_demo: true,
        subscription_tier: "pro",
        subscription_status: "active",
        demo_expires_at: demoExpiresAt,
      })
      .select("id, slug")
      .single();

    if (restaurantError || !restaurant) {
      console.error("demo/create restaurant insert:", restaurantError);
      return errorResponse(
        "Could not create the demo restaurant.",
        500,
        restaurantError?.message ?? restaurantError?.details ?? restaurantError?.hint
      );
    }

    const { data: category, error: categoryError } = await admin
      .from("categories")
      .insert({
        restaurant_id: restaurant.id,
        name: "Burgers",
        display_order: 0,
      })
      .select("id")
      .single();

    if (categoryError || !category) {
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      return errorResponse(
        "Could not create the demo menu category.",
        500,
        categoryError?.message
      );
    }

    let imageUrl = DEMO_BURGER_FALLBACK_IMAGE;
    try {
      imageUrl = await generateDemoBurgerImageUrl();
    } catch (err) {
      console.error("demo/create burger image generation failed:", err);
    }

    const { error: menuItemError } = await admin.from("menu_items").insert({
      restaurant_id: restaurant.id,
      category_id: category.id,
      name: "Demo Burger",
      description: "A delicious demo burger to get you started.",
      price: 5.0,
      image_url: imageUrl,
    });

    if (menuItemError) {
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      return errorResponse("Could not create the demo menu item.", 500, menuItemError.message);
    }

    const { error: tableError } = await admin.from("tables").insert({
      restaurant_id: restaurant.id,
      table_number: "1",
    });

    if (tableError) {
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      return errorResponse("Could not create the demo table.", 500, tableError.message);
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      restaurant_id: restaurant.id,
      role: "owner",
      full_name: "Demo User",
    });

    if (profileError) {
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      return errorResponse(
        "Could not link your session to the demo restaurant.",
        500,
        profileError.message
      );
    }

    return NextResponse.json({ success: true, slug: restaurant.slug });
  } catch (err) {
    console.error("demo/create unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown server error";
    return errorResponse("Could not start the demo. Please try again.", 500, message);
  }
}
