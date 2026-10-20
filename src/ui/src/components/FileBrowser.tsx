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

interface Props {
  file: FileState;
}

export function FileBrowser({ file }: Props) {
  const requestIdRef = useRef(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [entries, setEntries] = useState<geodat.Entry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [entryFilter, setEntryFilter] = useState("");
  const [categorySearchOptions, setCategorySearchOptions] =
    useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [entrySearchOptions, setEntrySearchOptions] = useState<SearchOptions>(
    DEFAULT_SEARCH_OPTIONS,
  );
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Карта снятых галочек: { category: ["domain1.com", "domain2.com"] }
  const [excludedByCat, setExcludedByCat] = useState<Record<string, string[]>>({});
  // Карта добавленных пользователем записей: { category: [{ type: "domain", value: "my.site" }] }
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

  // Объединяем оригинальные записи категории и добавленные пользователем
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
    setAddedByCat((prev) => {
      const existing = prev[selectedCategory] || [];
      if (existing.some((e) => e.value === entry.value)) return prev;
      return {
        ...prev,
        [selectedCategory]: [entry, ...existing],
      };
    });
    // Если запись была в исключенных, убираем из исключенных
    setExcludedByCat((prev) => ({
      ...prev,
      [selectedCategory]: (prev[selectedCategory] || []).filter((v) => v !== entry.value),
    }));
  };

  const handleApplyTextList = (textLines: string[], scopeValues?: string[]) => {
    if (!selectedCategory) return;
    const origSet = new Set(entries.map((e) => e.value));
    const scopeSet = scopeValues ? new Set(scopeValues) : null;
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
        if (["domain", "full", "keyword", "regexp"].includes(prefix)) {
          type = prefix;
          value = line.slice(colonIdx + 1).trim();
        }
      }

      if (!value) continue;
      keepSet.add(value);

      if (!origSet.has(value)) {
        parsedCustom.push({ type, value } as geodat.Entry);
      }
    }

    setExcludedByCat((prev) => {
      const prevExcl = new Set(prev[selectedCategory] || []);
      for (const e of entries) {
        // Меняем статус только тех записей, которые входили в область видимости фильтра
        if (!scopeSet || scopeSet.has(e.value)) {
          if (keepSet.has(e.value)) {
            prevExcl.delete(e.value);
          } else {
            prevExcl.add(e.value);
          }
        }
      }
      return {
        ...prev,
        [selectedCategory]: Array.from(prevExcl),
      };
    });

    setAddedByCat((prev) => {
      const prevAdded = prev[selectedCategory] || [];
      // Сохраняем пользовательские записи, которые были скрыты фильтром
      const untouchedAdded = scopeSet
        ? prevAdded.filter((e) => !scopeSet.has(e.value))
        : [];
      const merged = [...untouchedAdded];
      const existingVals = new Set(merged.map((e) => e.value));

      for (const item of parsedCustom) {
        if (!existingVals.has(item.value)) {
          merged.push(item);
          existingVals.add(item.value);
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
        excludedValues={currentExcluded}
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