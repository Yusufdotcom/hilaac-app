import {
  BrainCircuit,
  CalendarDays,
  HeartHandshake,
  MessageSquare,
  PackageSearch,
  Plane,
} from "lucide-react";

const FEATURE_GROUPS = [
  {
    problem: "Know your profits",
    icon: BrainCircuit,
    description: "Menu Intelligence and cost tracking so every dish earns its place.",
    tags: ["Menu Intelligence", "Cost tracking", "P&L"],
  },
  {
    problem: "Never run out",
    icon: PackageSearch,
    description: "Inventory levels and smart reorder alerts before the lunch rush hits.",
    tags: ["Inventory", "Smart Reorder"],
  },
  {
    problem: "Manage events",
    icon: CalendarDays,
    description: "Ramadan packages, wedding halls, and seasonal event menus — Somali Airlines.",
    tags: ["Ramadan", "Wedding halls", "Events"],
  },
  {
    problem: "Serve loyal customers",
    icon: HeartHandshake,
    description: "Deyn ledger, loyalty, and customer subscriptions in one place.",
    tags: ["Deyn", "Loyalty", "Subscriptions"],
  },
  {
    problem: "Run from anywhere",
    icon: Plane,
    description: "Diaspora Mode keeps owners abroad connected to every branch.",
    tags: ["Diaspora Mode", "Multi-branch"],
  },
  {
    problem: "Just ask",
    icon: MessageSquare,
    description: "AI Business Chatbot answers with live numbers — Galeyr and above.",
    tags: ["AI Chatbot", "Galeyr+"],
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-white/10 bg-[#0F172A] px-4 py-16 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          Built around the problems you actually face
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-[#94A3B8] sm:mt-4 sm:text-lg">
          Business intelligence for Somali restaurants — profits, stock, events, loyalty, and
          answers you can ask out loud.
        </p>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:max-w-none lg:grid-cols-3">
          {FEATURE_GROUPS.map((group) => (
            <article
              key={group.problem}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-[#D4A373]/40 sm:p-6 lg:p-7"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4A373]/15 text-[#D4A373]">
                <group.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white">{group.problem}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{group.description}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {group.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-[#CBD5E1]"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
