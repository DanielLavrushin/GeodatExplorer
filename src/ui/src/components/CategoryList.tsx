import { useMemo } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Chip,
  Stack,
  CircularProgress,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import { FileState } from "../types/index";
import { buildMatcher, SearchOptions } from "../lib/matcher";
import { SearchOptionsToggle } from "./SearchOptionsToggle";

interface Props {
  file: FileState;
  filter: string;
  onFilterChange: (value: string) => void;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  loading: boolean;
  searchButton?: React.ReactNode;
}

export function CategoryList({
  file,
  filter,
  onFilterChange,
  searchOptions,
  onSearchOptionsChange,
  selectedCategory,
  onSelectCategory,
  loading,
  searchButton,
}: Props) {
  const { match, error: filterError } = useMemo(
    () => buildMatcher(filter, searchOptions),
    [filter, searchOptions],
  );

  const filtered = file.categories.filter(match);

  return (
    <Box
      sx={{
        width: 280,
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ p: 1 }}>
        <Tooltip title={filterError ?? ""} placement="bottom-start">
          <TextField
            size="small"
            fullWidth
            placeholder={
              searchOptions.regex
                ? "Filter categories by regex..."
                : "Filter categories..."
            }
            value={filter}
            error={!!filterError}
            onChange={(e) => onFilterChange(e.target.value)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchOptionsToggle
                      value={searchOptions}
                      onChange={onSearchOptionsChange}
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Tooltip>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={file.type} size="small" color="primary" />
          <Chip
            label={`${file.categories.length} categories`}
            size="small"
            variant="outlined"
          />
          <Box sx={{ ml: "auto" }}>{searchButton}</Box>
        </Stack>
      </Box>
      <List sx={{ flex: 1, overflow: "auto" }} dense>
        {loading && !selectedCategory ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          filtered.map((cat) => (
            <ListItemButton
              key={cat}
              selected={selectedCategory === cat}
              onClick={() => onSelectCategory(cat)}
            >
              <ListItemText
                primary={
                  cat.length === 2
                    ? `${String.fromCodePoint(...[...cat.toUpperCase()].map((c) => 0x1f1e6 + (c.codePointAt(0) ?? 65) - 65))} ${cat.toUpperCase()}`
                    : `🏷️ ${cat}`
                }
                slotProps={{ primary: { sx: { fontFamily: "monospace" } } }}
              />
            </ListItemButton>
          ))
        )}
      </List>
    </Box>
  );
}
