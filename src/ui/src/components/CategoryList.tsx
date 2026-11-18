import { useEffect, useMemo, useState } from "react";
import { useSafeFilter } from "../lib/useSafeFilter";
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
  Checkbox,
} from "@mui/material";
import { FileState } from "../types/index";
import { SearchOptions } from "../lib/matcher";
import { SearchOptionsToggle } from "./SearchOptionsToggle";
import { ExportBar, ExportState } from "./ExportBar";

interface Props {
  file: FileState;
  filter: string;
  onFilterChange: (value: string) => void;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  loading: boolean;
  actions?: React.ReactNode;
  exportState: ExportState | null;
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
  actions,
  exportState,
}: Props) {
  const { indices, error: filterError } = useSafeFilter(
    file.categories,
    filter,
    searchOptions,
  );

  const filtered = useMemo(
    () =>
      indices
        ? Array.from(indices, (i) => file.categories[i])
        : file.categories,
    [indices, file.categories],
  );

  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const selection = exportState?.selection;
  const selectionSet = useMemo(() => new Set(selection ?? []), [selection]);

  useEffect(() => {
    if (selectionSet.size === 0) setShowSelectedOnly(false);
  }, [selectionSet]);

  const shown = useMemo(
    () =>
      exportState && showSelectedOnly
        ? filtered.filter((cat) => selectionSet.has(cat))
        : filtered,
    [exportState, showSelectedOnly, filtered, selectionSet],
  );

  const isModified = (cat: string) =>
    !!exportState &&
    ((exportState.excludedByCat[cat]?.length ?? 0) > 0 ||
      (exportState.addedByCat[cat]?.length ?? 0) > 0);

  const toggleSelected = (cat: string) => {
    if (!exportState) return;
    exportState.setSelection(
      selectionSet.has(cat)
        ? exportState.selection.filter((c) => c !== cat)
        : [...exportState.selection, cat],
    );
  };

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
          <Box sx={{ ml: "auto" }}>{actions}</Box>
        </Stack>
      </Box>
      <List sx={{ flex: 1, overflow: "auto" }} dense>
        {loading && !selectedCategory ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          shown.map((cat) => (
            <ListItemButton
              key={cat}
              selected={selectedCategory === cat}
              onClick={() => onSelectCategory(cat)}
            >
              {exportState && (
                <Checkbox
                  edge="start"
                  size="small"
                  disableRipple
                  checked={selectionSet.has(cat)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelected(cat);
                  }}
                  sx={{ p: 0.5, mr: 0.5 }}
                  slotProps={{ input: { "aria-label": `Export ${cat}` } }}
                />
              )}
              <ListItemText
                primary={`${
                  cat.length === 2
                    ? `${String.fromCodePoint(...[...cat.toUpperCase()].map((c) => 0x1f1e6 + (c.codePointAt(0) ?? 65) - 65))} ${cat.toUpperCase()}`
                    : `🏷️ ${cat}`
                }${isModified(cat) ? " *" : ""}`}
                slotProps={{ primary: { sx: { fontFamily: "monospace" } } }}
              />
            </ListItemButton>
          ))
        )}
      </List>
      {exportState && (
        <ExportBar
          file={file}
          state={exportState}
          shownCategories={filtered}
          showSelectedOnly={showSelectedOnly}
          onShowSelectedOnlyChange={setShowSelectedOnly}
        />
      )}
    </Box>
  );
}
