import Image from "next/image";
import { cn } from "@/lib/utils";

const HILAAC_URL = "https://hilaac-app.vercel.app";

type PoweredByHilaacProps = {
  variant?: "light" | "dark";
  className?: string;
};

export function PoweredByHilaac({ variant = "light", className }: PoweredByHilaacProps) {
  return (
    <footer className={cn("flex justify-center", className)}>
      <a
        href={HILAAC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80",
          variant === "dark"
            ? "text-white/50 hover:text-white/70"
            : "text-[#94A3B8] hover:text-[#64748B]"
        )}
      >
        <Image
          src="/logo-icon.png"
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 object-contain"
          aria-hidden="true"
        />
        <span>Powered by Hilaac Smart Solution</span>
      </a>
    </footer>
  );
}
