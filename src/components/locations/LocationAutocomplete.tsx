"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

type Suggestion = { placeId: string; displayName: string };

type LocationAutocompleteProps = {
  label: string;
  placeholder: string;
  value: { placeId: string; displayName: string } | null;
  onSelect: (value: { placeId: string; displayName: string } | null) => void;
  countryCode?: string;
  minChars?: number;
  disabled?: boolean;
  error?: string;
  sessionToken: string;
};

export function LocationAutocomplete({
  label,
  placeholder,
  value,
  onSelect,
  countryCode,
  minChars = 2,
  disabled = false,
  error,
  sessionToken,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value?.displayName ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiError, setApiError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setQuery(value?.displayName ?? "");
  }, [value?.placeId, value?.displayName]);

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

      setLoading(true);
      setApiError("");
      const params = new URLSearchParams({
        query: query.trim(),
        sessionToken,
      });
      if (countryCode?.trim()) params.set("countryCode", countryCode.trim());

      fetch(`/api/locations/autocomplete?${params.toString()}`, { signal: ac.signal })
        .then(async (res) => {
          const data = (await res.json()) as { suggestions?: Suggestion[]; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Konum araması başarısız");
          return data.suggestions ?? [];
        })
        .then((list) => {
          setItems(list);
          setActiveIndex(list.length > 0 ? 0 : -1);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setItems([]);
          setApiError(e instanceof Error ? e.message : "Konum araması başarısız");
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, open, canSearch, countryCode, sessionToken]);

  function selectItem(item: Suggestion) {
    onSelect(item);
    setQuery(item.displayName);
    setOpen(false);
    setItems([]);
    setActiveIndex(-1);
  }

  return (
    <div className="relative space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (value) onSelect(null); // serbest yazı geçerli değil
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // küçük delay: click selection
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (activeIndex >= 0 && items[activeIndex]) {
              e.preventDefault();
              selectItem(items[activeIndex]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {(error || apiError) && (
        <p className="text-xs text-destructive">{error || apiError}</p>
      )}

      {open && (loading || items.length > 0 || apiError) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md">
          {loading && <div className="px-2 py-2 text-xs text-muted-foreground">Yükleniyor...</div>}
          {!loading && apiError && (
            <div className="px-2 py-2 text-xs text-destructive">{apiError}</div>
          )}
          {!loading && !apiError && items.length === 0 && canSearch && (
            <div className="px-2 py-2 text-xs text-muted-foreground">Sonuç bulunamadı</div>
          )}
          {!loading &&
            !apiError &&
            items.map((item, idx) => (
              <button
                key={item.placeId}
                type="button"
                className={cn(
                  "w-full rounded px-2 py-2 text-left text-sm hover:bg-muted",
                  idx === activeIndex && "bg-muted",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(item)}
              >
                {item.displayName}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

