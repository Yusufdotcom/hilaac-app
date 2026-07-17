"use client";

import { useState } from "react";
import { ArrowLeft, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RestaurantTable } from "@/types/database";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function TableStep({
  tables,
  onConfirm,
  onBack,
  className,
}: {
  restaurant: { name: string };
  tables: RestaurantTable[];
  onConfirm: (tableNumber: string) => void;
  onBack: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");

  function press(key: string) {
    if (key === "back") {
      setValue((v) => v.slice(0, -1));
    } else if (key) {
      setValue((v) => (v.length < 4 ? v + key : v));
    }
  }

  const knownTable = tables.find((t) => t.table_number === value);
  const canConfirm = value.length > 0 && (tables.length === 0 || !!knownTable);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col px-5 py-4", className)}>
      <div className="shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Dib u noqo
        </button>

        <div className="mt-4 text-center">
          <h1 className="text-xl font-bold">Lambarka miiska</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fadlan gali lambarka miiska aad ku fadhiyo</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="flex h-16 w-36 items-center justify-center rounded-2xl border-2 border-primary text-3xl font-bold">
          {value || <span className="text-muted-foreground">—</span>}
        </div>

        {tables.length > 0 && value && !knownTable && (
          <p className="mt-3 text-center text-sm text-destructive">
            Miiskaas lama helin. Fadlan hubi lambarka.
          </p>
        )}

        <div className="mt-4 grid w-full max-w-xs grid-cols-3 gap-2">
          {KEYS.map((key, idx) =>
            key === "" ? (
              <div key={idx} />
            ) : (
              <button
                key={idx}
                onClick={() => press(key)}
                className="flex h-12 items-center justify-center rounded-xl border bg-card text-lg font-semibold transition-colors active:bg-muted"
              >
                {key === "back" ? <Delete className="h-5 w-5" /> : key}
              </button>
            )
          )}
        </div>
      </div>

      <div className="shrink-0 pt-3">
        <Button size="lg" className="h-12 w-full" disabled={!canConfirm} onClick={() => onConfirm(value)}>
          Sii wad
        </Button>
      </div>
    </div>
  );
}
