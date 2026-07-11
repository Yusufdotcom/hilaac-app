"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Fixed 48px logo icon — same size across landing, auth, and dashboard. */
const LOGO_ICON_CLASS = "h-12 w-12 shrink-0 object-contain";

type HilaacLogoProps = {
  className?: string;
  showWordmark?: boolean;
  href?: string | null;
  variant?: "default" | "light";
  /** Logo image path — defaults to `/logo-icon.png`, falls back to `/logo.png` */
  src?: string;
  wordmarkClassName?: string;
};

export function HilaacLogo({
  className,
  showWordmark = true,
  href = "/",
  variant = "default",
  src = "/logo-icon.png",
  wordmarkClassName,
}: HilaacLogoProps) {
  const [imgSrc, setImgSrc] = useState(src);

  const wordmarkColor = variant === "light" ? "text-white" : "text-hilaac-navy";

  const content = (
    <>
      <Image
        src={imgSrc}
        alt="Hilaac"
        width={48}
        height={48}
        className={LOGO_ICON_CLASS}
        priority
        onError={() => {
          if (imgSrc !== "/logo.png") setImgSrc("/logo.png");
        }}
      />
      {showWordmark && (
        <span
          className={cn(
            "text-lg font-extrabold tracking-tight",
            wordmarkColor,
            wordmarkClassName
          )}
        >
          Hilaac
        </span>
      )}
    </>
  );

  const wrapperClass = cn("flex shrink-0 items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={wrapperClass} aria-label="Hilaac home">
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}

/** Landing & dark-surface logo — alias for HilaacLogo with light wordmark. */
export function Logo(props: Omit<HilaacLogoProps, "variant">) {
  return <HilaacLogo variant="light" {...props} />;
}
