"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import type { MetaLocationOption } from "@/types/meta-assets";

type MetaLocationAutocompleteProps = {
  label: string;
  placeholder: string;
  value: MetaLocationOption | null;
  onSelect: (value: MetaLocationOption | null) => void;
  connectionId?: string;
  countryCode?: string;
  minChars?: number;
  disabled?: boolean;
  error?: string;
};

export function MetaLocationAutocomplete({
  label,
  placeholder,
  value,
  onSelect,
  connectionId,
  countryCode,
  minChars = 2,
  disabled = false,
  error,
}: MetaLocationAutocompleteProps) {
  const [query, setQuery] = useState(value?.displayName ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MetaLocationOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiError, setApiError] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(value?.displayName ?? "");
  }, [value?.key, value?.displayName]);

  const canSearch = useMemo(() => query.trim().length >= minChars, [query, minChars]);

  useEffect(() => {
    if (!open) return;
    if (!canSearch) {
      setItems([]);
      setLoading(false);
      setApiError("");
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setApiError("");

      const params = new URLSearchParams({ query: query.trim() });
      if (connectionId?.trim()) params.set("connectionId", connectionId.trim());
      if (countryCode?.trim()) params.set("countryCode", countryCode.trim());

      fetch(`/api/meta/targeting-locations?${params.toString()}`, { signal: ac.signal })
        .then(async (res) => {
          const data = (await res.json()) as {
            locations?: MetaLocationOption[];
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? "Meta konum araması başarısız oldu");
          return data.locations ?? [];
        })
        .then((list) => {
          if (requestId !== requestIdRef.current) return;
          setItems(list);
          setActiveIndex(list.length > 0 ? 0 : -1);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          if (requestId !== requestIdRef.current) return;
          setItems([]);
          setApiError(e instanceof Error ? e.message : "Meta konum araması başarısız oldu");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, canSearch, connectionId, countryCode]);

  function choose(item: MetaLocationOption) {
    onSelect(item);
    setQuery(item.displayName);
    setOpen(false);
    setItems([]);
  }

  return (
    <div className="relative space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Input
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onSelect(null);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            choose(items[activeIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && canSearch && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Aranıyor...</div>}
          {!loading && apiError && (
            <div className="px-3 py-2 text-xs text-destructive">{apiError}</div>
          )}
          {!loading && !apiError && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Sonuç bulunamadı</div>
          )}
          {!loading &&
            items.map((item, index) => (
              <button
                key={`${item.type}-${item.key}`}
                type="button"
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm hover:bg-muted",
                  index === activeIndex && "bg-muted",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
              >
                <div>{item.displayName}</div>
                <div className="text-xs text-muted-foreground capitalize">{item.type}</div>
              </button>
            ))}
        </div>
      )}
      {(error || apiError) && !open && (
        <p className="text-xs text-destructive">{error || apiError}</p>
      )}
      {value && (
        <p className="text-xs text-muted-foreground">Meta konumu seçildi: {value.displayName}</p>
      )}
    </div>
  );
}
