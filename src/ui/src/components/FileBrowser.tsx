import { useState, useRef } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { CategoryList } from "./CategoryList";
import { EntryList } from "./EntryList";
import { GlobalSearch } from "./GlobalSearch";
import { FileState } from "../types/index";
import { geodat } from "../wailsjs/go/models";
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
  const [searchOpen, setSearchOpen] = useState(false);

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
        entries={entries}
        filter={entryFilter}
        onFilterChange={setEntryFilter}
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
