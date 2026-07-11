"use client";

import { useState } from "react";
import { ArrowLeft, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestaurantTable } from "@/types/database";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function TableStep({
  restaurant,
  tables,
  onConfirm,
  onBack,
}: {
  restaurant: { name: string };
  tables: RestaurantTable[];
  onConfirm: (tableNumber: string) => void;
  onBack: () => void;
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
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Dib u noqo
      </button>

      <div className="text-center">
        <h1 className="text-xl font-bold">Lambarka miiska</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fadlan gali lambarka miiska aad ku fadhiyo</p>
      </div>

      <div className="my-10 flex justify-center">
        <div className="flex h-20 w-40 items-center justify-center rounded-2xl border-2 border-primary text-4xl font-bold">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
      </div>

      {tables.length > 0 && value && !knownTable && (
        <p className="mb-4 text-center text-sm text-destructive">Miiskaas lama helin. Fadlan hubi lambarka.</p>
      )}

      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key, idx) =>
          key === "" ? (
            <div key={idx} />
          ) : (
            <button
              key={idx}
              onClick={() => press(key)}
              className="flex h-16 items-center justify-center rounded-xl border bg-card text-xl font-semibold transition-colors active:bg-muted"
            >
              {key === "back" ? <Delete className="h-5 w-5" /> : key}
            </button>
          )
        )}
      </div>

      <div className="mt-auto pt-8">
        <Button size="lg" className="w-full" disabled={!canConfirm} onClick={() => onConfirm(value)}>
          Sii wad
        </Button>
      </div>
    </div>
  );
}
