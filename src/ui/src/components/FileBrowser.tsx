import { useState } from "react";
import { Box } from "@mui/material";
import { CategoryList } from "./CategoryList";
import { EntryList } from "./EntryList";
import { FileState } from "../types/index";
import { LoadDomains, LoadIPs } from "../wailsjs/go/main/App";

interface Props {
  file: FileState;
}

export function FileBrowser({ file }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [entries, setEntries] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [entryFilter, setEntryFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSelectCategory = async (category: string) => {
    setSelectedCategory(category);
    setEntryFilter("");
    setLoading(true);

    try {
      let data: string[] = [];
      if (file.type === "geosite") {
        data = await LoadDomains(file.path, [category]);
      } else if (file.type === "geoip") {
        data = await LoadIPs(file.path, [category]);
      }
      setEntries(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
