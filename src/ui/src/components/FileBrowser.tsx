import { useState, useRef } from "react";
import { Box } from "@mui/material";
import { CategoryList } from "./CategoryList";
import { EntryList } from "./EntryList";
import { FileState, geodat } from "../types/index";
import { LoadDomains, LoadIPs } from "../wailsjs/go/main/App";

interface Props {
  file: FileState;
}

export function FileBrowser({ file }: Props) {
  const requestIdRef = useRef(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [entries, setEntries] = useState<geodat.Entry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [entryFilter, setEntryFilter] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <CategoryList
        file={file}
        filter={categoryFilter}
        onFilterChange={setCategoryFilter}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        loading={loading}
      />
      <EntryList
        category={selectedCategory}
        entries={entries}
        filter={entryFilter}
        onFilterChange={setEntryFilter}
        loading={loading && !!selectedCategory}
      />
    </Box>
  );
}
