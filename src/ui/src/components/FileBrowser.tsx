import { useState, useRef, useMemo } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
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

  const [exportMode, setExportMode] = useState(false);
  const [exportSelection, setExportSelection] = useState<string[]>([]);
  const [excludedByCat, setExcludedByCat] = useState<Record<string, string[]>>({});
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

  const editable =
    exportMode &&
    !!selectedCategory &&
    exportSelection.includes(selectedCategory);

  const shownEntries = useMemo(() => {
    if (!editable || !selectedCategory) return entries;
    const custom = addedByCat[selectedCategory] || [];
    return [...custom, ...entries];
  }, [editable, entries, addedByCat, selectedCategory]);

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
      for (const key of keepSet) {
        prevExcl.delete(key);
      }
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
        exportState={
          exportMode
            ? {
                selection: exportSelection,
                setSelection: setExportSelection,
                excludedByCat,
                addedByCat,
              }
            : null
        }
        actions={
          <>
            <Tooltip title="Global search (find which category contains...)">
              <IconButton size="small" onClick={() => setSearchOpen(true)}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={
                exportMode
                  ? "Leave export mode"
                  : "Export categories to a new .dat file"
              }
            >
              <IconButton
                size="small"
                color={exportMode ? "primary" : "default"}
                onClick={() => setExportMode((v) => !v)}
              >
                <FileDownloadOutlinedIcon />
              </IconButton>
            </Tooltip>
          </>
        }
      />
      <EntryList
        category={selectedCategory}
        fileType={file.type}
        entries={shownEntries}
        editing={
          editable
            ? {
                excludedKeys: currentExcluded,
                onChangeExcluded: handleUpdateExcluded,
                onApplyText: handleApplyTextList,
              }
            : null
        }
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
