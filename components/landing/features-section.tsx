import { QrCode, ChefHat, UserRound, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: QrCode,
    title: "QR Ordering",
    description:
      "Customers scan, browse, and order from their phone — no app required. Instant table service.",
  },
  {
    icon: ChefHat,
    title: "Kitchen Display",
    description:
      "Real-time tickets from New → Preparing → Ready with one tap. No shouting, no paper slips.",
  },
  {
    icon: UserRound,
    title: "Waiter Dashboard",
    description:
      "Waiters see ready orders instantly, mark them Delivered, and track performance — all from one shared tablet.",
  },
  {
    icon: Sparkles,
    title: "AI Menu",
    description:
      "Generate mouth-watering dish photos for your menu in seconds. Turn text into pro-quality food imagery.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-white/10 bg-[#0F172A] px-4 py-16 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          Built for modern restaurants
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base leading-relaxed text-[#94A3B8] sm:mt-4 sm:text-lg">
          Everything you need to take orders, run the kitchen, and get paid — in one platform.
        </p>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-4 sm:mt-16 sm:gap-6 lg:max-w-none lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm shadow-black/10 transition-colors hover:border-[#D4A373]/40 hover:shadow-[#D4A373]/10 sm:p-6 lg:p-8"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4A373]/15 text-[#D4A373] sm:mb-5 sm:h-12 sm:w-12">
                <feature.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-white sm:text-lg lg:text-xl">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400 sm:mt-3 sm:text-base">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
