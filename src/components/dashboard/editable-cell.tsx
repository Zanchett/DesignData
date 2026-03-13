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

interface EditableCellProps {
  value: string | number | null;
  field: string;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
  onSave: (field: string, value: string | number | null) => void;
  className?: string;
  disabled?: boolean;
}

export function EditableCell({
  value,
  field,
  type = "text",
  options,
  onSave,
  className,
  disabled = false,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === String(value ?? "")) return;

    if (type === "number") {
      const num = trimmed === "" ? null : Number(trimmed);
      if (num !== null && isNaN(num)) return;
      onSave(field, num);
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
    return (
      <Select
        value={String(value ?? "")}
        onValueChange={(v) => onSave(field, v || null)}
      >
        <SelectTrigger className="h-7 min-w-[100px] border-transparent bg-transparent text-xs hover:border-border focus:border-border">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
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
          : value || "—"}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type === "date" ? "date" : type === "number" ? "number" : "text"}
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
