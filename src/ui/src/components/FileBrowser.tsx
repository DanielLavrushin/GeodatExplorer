import { useState, useRef, useMemo } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { CategoryList } from "./CategoryList";
import { EntryList } from "./EntryList";
import { GlobalSearch } from "./GlobalSearch";
import { FileState } from "../types/index";
import { geodat } from "../wailsjs/go/models";
import { LoadDomains, LoadIPs } from "../wailsjs/go/main/App";
import { DEFAULT_SEARCH_OPTIONS, SearchOptions } from "../lib/matcher";
import { entryKey, GEOSITE_TEXT_TYPES } from "../lib/entryKey";

interface Props {
  file: FileState;
}

export function FileBrowser({ file }: Props) {
  const requestIdRef = useRef(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [entries, setEntries] = useState<geodat.Entry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [entryFilter, setEntryFilter] = useState("");
  // Modifiers are deliberately not reset when the category changes — they are a
  // standing preference, unlike the filter text.
  const [categorySearchOptions, setCategorySearchOptions] =
    useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [entrySearchOptions, setEntrySearchOptions] = useState<SearchOptions>(
    DEFAULT_SEARCH_OPTIONS,
  );
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Unchecked rules per category, as entryKey() strings: { category: ["domain:a.com", "full:b.com"] }
  const [excludedByCat, setExcludedByCat] = useState<Record<string, string[]>>({});
  // Rules the user added per category: { category: [{ type: "domain", value: "my.site" }] }
  const [addedByCat, setAddedByCat] = useState<Record<string, geodat.Entry[]>>({});

  const handleSelectCategory = async (category: string) => {
    const requestId = ++requestIdRef.current;

    setSelectedCategory(category);
    setEntryFilter("");
    setEntries([]);
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      let data: geodat.Entry[] = [];
      if (file.type === "geosite") {
        data = await LoadDomains(file.path, [category]);
      } else if (file.type === "geoip") {
        data = await LoadIPs(file.path, [category]);
      }

      if (requestId === requestIdRef.current) {
        setEntries(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // User-added rules first, then the category's own rules
  const combinedEntries = useMemo(() => {
    if (!selectedCategory) return [];
    const custom = addedByCat[selectedCategory] || [];
    return [...custom, ...entries];
  }, [entries, addedByCat, selectedCategory]);

  const currentExcluded = useMemo(() => {
    if (!selectedCategory) return [];
    return excludedByCat[selectedCategory] || [];
  }, [excludedByCat, selectedCategory]);

  const handleUpdateExcluded = (newExcluded: string[]) => {
    if (!selectedCategory) return;
    setExcludedByCat((prev) => ({
      ...prev,
      [selectedCategory]: newExcluded,
    }));
  };

  const handleAddEntry = (entry: geodat.Entry) => {
    if (!selectedCategory) return;
    const key = entryKey(entry);
    // Re-adding an original rule only needs to re-check it.
    if (!entries.some((e) => entryKey(e) === key)) {
      setAddedByCat((prev) => {
        const existing = prev[selectedCategory] || [];
        if (existing.some((e) => entryKey(e) === key)) return prev;
        return {
          ...prev,
          [selectedCategory]: [entry, ...existing],
        };
      });
    }
    setExcludedByCat((prev) => ({
      ...prev,
      [selectedCategory]: (prev[selectedCategory] || []).filter((k) => k !== key),
    }));
  };

  const handleApplyTextList = (textLines: string[], scopeKeys: string[]) => {
    if (!selectedCategory) return;
    const origKeys = new Set(entries.map(entryKey));
    const scopeSet = new Set(scopeKeys);
    const keepSet = new Set<string>();
    const parsedCustom: geodat.Entry[] = [];

    for (const raw of textLines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      let type = file.type === "geoip" ? "cidr" : "domain";
      let value = line;

      const colonIdx = line.indexOf(":");
      if (colonIdx > 0 && file.type === "geosite") {
        const prefix = line.slice(0, colonIdx).toLowerCase();
        if (GEOSITE_TEXT_TYPES.includes(prefix)) {
          type = prefix;
          value = line.slice(colonIdx + 1).trim();
        }
      }

      if (!value) continue;
      const key = entryKey({ type, value });
      if (keepSet.has(key)) continue;
      keepSet.add(key);

      if (!origKeys.has(key)) {
        parsedCustom.push({ type, value } as geodat.Entry);
      }
    }

    setExcludedByCat((prev) => {
      const prevExcl = new Set(prev[selectedCategory] || []);
      // Anything listed in the editor is wanted, including rules that were
      // unchecked or hidden by the filter when the editor opened.
      for (const key of keepSet) {
        prevExcl.delete(key);
      }
      // Rules that were shown in the editor and removed from it are unchecked.
      for (const e of entries) {
        const key = entryKey(e);
        if (scopeSet.has(key) && !keepSet.has(key)) {
          prevExcl.add(key);
        }
      }
      return {
        ...prev,
        [selectedCategory]: Array.from(prevExcl),
      };
    });

    setAddedByCat((prev) => {
      const prevAdded = prev[selectedCategory] || [];
      // Keep custom rules the editor did not show (unchecked or filtered out).
      const untouchedAdded = prevAdded.filter((e) => !scopeSet.has(entryKey(e)));
      const merged = [...untouchedAdded];
      const existingKeys = new Set(merged.map(entryKey));

      for (const item of parsedCustom) {
        const key = entryKey(item);
        if (!existingKeys.has(key)) {
          merged.push(item);
          existingKeys.add(key);
        }
      }
      return {
        ...prev,
        [selectedCategory]: merged,
      };
    });
  };

  return (
    <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <CategoryList
        file={file}
        filter={categoryFilter}
        onFilterChange={setCategoryFilter}
        searchOptions={categorySearchOptions}
        onSearchOptionsChange={setCategorySearchOptions}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        loading={loading}
        excludedByCat={excludedByCat}
        addedByCat={addedByCat}
        searchButton={
          <Tooltip title="Global search (find which category contains...)">
            <IconButton size="small" onClick={() => setSearchOpen(true)}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <EntryList
        category={selectedCategory}
        fileType={file.type}
        entries={combinedEntries}
        excludedKeys={currentExcluded}
        onChangeExcluded={handleUpdateExcluded}
        onAddEntry={handleAddEntry}
        onApplyTextList={handleApplyTextList}
        filter={entryFilter}
        onFilterChange={setEntryFilter}
        searchOptions={entrySearchOptions}
        onSearchOptionsChange={setEntrySearchOptions}
        loading={loading && !!selectedCategory}
      />
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        filePath={file.path}
        fileType={file.type}
        onSelectCategory={handleSelectCategory}
      />
    </Box>
  );
}
