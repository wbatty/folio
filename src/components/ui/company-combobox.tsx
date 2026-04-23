"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
}

interface CompanyComboboxProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  id?: string;
}

export function CompanyCombobox({ value, onChange, placeholder = "Acme Corp", id }: CompanyComboboxProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data: Company[]) => setCompanies(data.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const trimmed = query.trim();
  const filtered = trimmed
    ? companies.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : companies;

  const exactMatch = companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const showAddOption = trimmed.length > 0 && !exactMatch;
  const showDropdown = open && (filtered.length > 0 || showAddOption);

  async function handleAdd() {
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const company: Company = await res.json();
        setCompanies((prev) => [...prev, { id: company.id, name: company.name }]);
        onChange(company.name);
        setQuery(company.name);
      }
    } finally {
      setAdding(false);
      setOpen(false);
    }
  }

  function handleSelect(company: Company) {
    onChange(company.name);
    setQuery(company.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        type="text"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-52 overflow-y-auto">
          {filtered.map((company) => {
            const selected = trimmed.toLowerCase() === company.name.toLowerCase();
            return (
              <button
                key={company.id}
                type="button"
                className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-accent gap-2"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(company); }}
              >
                {selected
                  ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  : <span className="w-3.5 flex-shrink-0" />}
                <span className={cn(selected && "font-medium")}>{company.name}</span>
              </button>
            );
          })}
          {showAddOption && (
            <button
              type="button"
              disabled={adding}
              className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-accent gap-2 text-primary border-t border-border"
              onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}
            >
              {adding
                ? <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                : <Plus className="h-3.5 w-3.5 flex-shrink-0" />}
              Add &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
