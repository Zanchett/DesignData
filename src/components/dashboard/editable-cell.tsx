"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Color map: value → { bg, text } tailwind classes for pill/badge styling
type ColorMap = Record<string, { bg: string; text: string }>;

interface EditableCellProps {
  value: string | number | null;
  field: string;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
  onSave: (field: string, value: string | number | null) => void;
  className?: string;
  disabled?: boolean;
  colorMap?: ColorMap;
}

export function EditableCell({
  value,
  field,
  type = "text",
  options,
  onSave,
  className,
  disabled = false,
  colorMap,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Display dates in MM-DD-YYYY (US) format
    const display = type === "date" && value ? isoToUs(String(value)) : String(value ?? "");
    setLocalValue(display);
  }, [value, type]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Convert YYYY-MM-DD ↔ MM-DD-YYYY for display
  const isoToUs = (v: string) => {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[2]}-${m[3]}-${m[1]}` : v;
  };
  const usToIso = (v: string) => {
    const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : v;
  };

  const handleSave = () => {
    setEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === String(value ?? "")) return;

    if (type === "number") {
      const num = trimmed === "" ? null : Number(trimmed);
      if (num !== null && isNaN(num)) return;
      onSave(field, num);
    } else if (type === "date") {
      // Convert US display format back to ISO for DB storage
      onSave(field, trimmed ? usToIso(trimmed) : null);
    } else {
      onSave(field, trimmed || null);
    }
  };

  if (disabled) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        {value ?? "—"}
      </span>
    );
  }

  if (type === "select" && options) {
    const colors = colorMap?.[String(value ?? "")];
    return (
      <Select
        value={String(value ?? "")}
        onValueChange={(v) => onSave(field, v || null)}
      >
        <SelectTrigger
          className={cn(
            "h-7 min-w-[100px] border-transparent text-xs hover:border-border focus:border-border",
            colors ? `${colors.bg} ${colors.text} font-medium rounded-full px-2.5` : "bg-transparent"
          )}
        >
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => {
            const optColors = colorMap?.[opt];
            return (
              <SelectItem key={opt} value={opt} className="text-xs">
                {optColors ? (
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", optColors.bg, optColors.text)}>
                    {opt}
                  </span>
                ) : opt}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  if (!editing) {
    return (
      <button
        className={cn(
          "w-full rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted/60 transition-colors min-h-[28px]",
          !value && "text-muted-foreground",
          className
        )}
        onClick={() => setEditing(true)}
      >
        {type === "number" && value != null
          ? Number(value).toLocaleString()
          : type === "date" && value
            ? isoToUs(String(value))
            : value || "—"}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type === "number" ? "number" : "text"}
      placeholder={type === "date" ? "MM-DD-YYYY" : undefined}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
          setLocalValue(String(value ?? ""));
          setEditing(false);
        }
      }}
      className={cn("h-7 text-xs", className)}
      step={type === "number" ? "0.5" : undefined}
    />
  );
}
