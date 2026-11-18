import { useEffect, useMemo, useState } from "react";
import {
  Box,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  Stack,
  TextField,
  Button,
  InputAdornment,
  Tooltip,
  Checkbox,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import SearchIcon from "@mui/icons-material/Search";
import CodeIcon from "@mui/icons-material/Code";
import HubIcon from "@mui/icons-material/Hub";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CheckIcon from "@mui/icons-material/Check";
import EditNoteIcon from "@mui/icons-material/EditNote";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { geodat } from "../wailsjs/go/models";
import { SearchOptions } from "../lib/matcher";
import { useDebounced } from "../lib/useDebounced";
import { useSafeFilter } from "../lib/useSafeFilter";
import { SearchOptionsToggle } from "./SearchOptionsToggle";
import { FileType } from "../types/index";
import { entryKey } from "../lib/entryKey";

export interface EntryEditing {
  excludedKeys: string[];
  onChangeExcluded: (excludedKeys: string[]) => void;
  onApplyText: (lines: string[], scopeKeys: string[]) => void;
}

interface Props {
  category: string | null;
  fileType: FileType;
  entries: geodat.Entry[];
  editing: EntryEditing | null;
  filter: string;
  onFilterChange: (value: string) => void;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  loading: boolean;
}

const typeConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  domain: {
    icon: <LanguageIcon sx={{ fontSize: 16 }} />,
    color: "#4caf50",
    label: "domain",
  },
  full: {
    icon: <GpsFixedIcon sx={{ fontSize: 16 }} />,
    color: "#2196f3",
    label: "full",
  },
  keyword: {
    icon: <SearchIcon sx={{ fontSize: 16 }} />,
    color: "#ff9800",
    label: "keyword",
  },
  regexp: {
    icon: <CodeIcon sx={{ fontSize: 16 }} />,
    color: "#e91e63",
    label: "regexp",
  },
  cidr: {
    icon: <HubIcon sx={{ fontSize: 16 }} />,
    color: "#9c27b0",
    label: "cidr",
  },
  include: {
    icon: <AccountTreeIcon sx={{ fontSize: 16 }} />,
    color: "#00bcd4",
    label: "include",
  },
};

const CHUNK_SIZE = 2000;

export function EntryList({
  category,
  fileType,
  entries,
  editing,
  filter,
  onFilterChange,
  searchOptions,
  onSearchOptionsChange,
  loading,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  // A category can hold tens of thousands of entries, so wait for a pause in
  // typing before re-scanning them all.
  const debouncedFilter = useDebounced(filter, 150);

  const values = useMemo(() => entries.map((e) => e.value), [entries]);
  const { indices, error: filterError } = useSafeFilter(
    values,
    debouncedFilter,
    searchOptions,
  );

  const isEditing = !!editing;
  const excludedKeys = editing?.excludedKeys;
  const excludedSet = useMemo(
    () => new Set(excludedKeys ?? []),
    [excludedKeys],
  );
  const [showIncludedOnly, setShowIncludedOnly] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [textScope, setTextScope] = useState<string[]>([]);

  useEffect(() => {
    setTextMode(false);
  }, [category, isEditing]);

  const filtered = useMemo(() => {
    const list = indices ? Array.from(indices, (i) => entries[i]) : entries;
    return isEditing && showIncludedOnly
      ? list.filter((e) => !excludedSet.has(entryKey(e)))
      : list;
  }, [indices, entries, isEditing, showIncludedOnly, excludedSet]);

  const includedCount = useMemo(
    () => entries.filter((e) => !excludedSet.has(entryKey(e))).length,
    [entries, excludedSet],
  );

  const toggleEntry = (key: string) => {
    if (!editing) return;
    editing.onChangeExcluded(
      excludedSet.has(key)
        ? editing.excludedKeys.filter((k) => k !== key)
        : [...editing.excludedKeys, key],
    );
  };

  const setShownIncluded = (include: boolean) => {
    if (!editing) return;
    const shownKeys = new Set(filtered.map(entryKey));
    editing.onChangeExcluded(
      include
        ? editing.excludedKeys.filter((k) => !shownKeys.has(k))
        : Array.from(new Set([...editing.excludedKeys, ...shownKeys])),
    );
  };

  const openTextMode = () => {
    const shown = filtered.filter((e) => !excludedSet.has(entryKey(e)));
    setRawText(
      shown
        .map((e) =>
          fileType === "geosite" && e.type !== "domain" ? entryKey(e) : e.value,
        )
        .join("\n"),
    );
    setTextScope(shown.map(entryKey));
    setTextMode(true);
  };

  const applyTextMode = () => {
    editing?.onApplyText(rawText.split("\n"), textScope);
    setTextMode(false);
  };

  const closeMenu = () => setMenuAnchor(null);

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [filtered]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {category && (
        <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle1" fontWeight="bold">
              {category}
            </Typography>
            <Chip
              label={`${filtered.length} entries`}
              size="small"
              variant="outlined"
            />
            <Tooltip title={filterError ?? ""} placement="bottom-end">
              <TextField
                size="small"
                placeholder={
                  searchOptions.regex
                    ? "Filter by regex..."
                    : "Filter entries..."
                }
                value={filter}
                disabled={textMode}
                error={!!filterError}
                onChange={(e) => onFilterChange(e.target.value)}
                sx={{ ml: "auto", width: 280 }}
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
          </Stack>
          {editing && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                {textMode
                  ? fileType === "geoip"
                    ? "One IP or CIDR per line"
                    : "One rule per line, e.g. example.com or full:example.com"
                  : `${includedCount} of ${entries.length} included in export`}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {textMode ? (
                <>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setTextMode(false)}
                    sx={{ textTransform: "none" }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={applyTextMode}
                    sx={{ textTransform: "none" }}
                  >
                    Apply
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    startIcon={<EditNoteIcon />}
                    onClick={openTextMode}
                    sx={{ textTransform: "none" }}
                  >
                    Edit as text
                  </Button>
                  <IconButton
                    size="small"
                    aria-label="More entry actions"
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Stack>
          )}
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
            <MenuItem
              onClick={() => {
                setShowIncludedOnly((v) => !v);
                closeMenu();
              }}
            >
              <ListItemIcon>
                {showIncludedOnly && <CheckIcon fontSize="small" />}
              </ListItemIcon>
              Show included only
            </MenuItem>
            <MenuItem
              onClick={() => {
                setShownIncluded(true);
                closeMenu();
              }}
            >
              <ListItemIcon />
              Include all shown ({filtered.length})
            </MenuItem>
            <MenuItem
              onClick={() => {
                setShownIncluded(false);
                closeMenu();
              }}
            >
              <ListItemIcon />
              Exclude all shown ({filtered.length})
            </MenuItem>
          </Menu>
        </Box>
      )}

      {loading ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              border: "4px solid",
              borderColor: "primary.main",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              "@keyframes spin": {
                "0%": { transform: "rotate(0deg)" },
                "100%": { transform: "rotate(360deg)" },
              },
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Loading entries...
          </Typography>
        </Box>
      ) : !category ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">
            Select a category to view entries
          </Typography>
        </Box>
      ) : textMode ? (
        <Box sx={{ flex: 1, p: 1, display: "flex" }}>
          <TextField
            multiline
            fullWidth
            autoFocus
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            sx={{
              flex: 1,
              "& .MuiInputBase-root": {
                height: "100%",
                alignItems: "flex-start",
                fontFamily: "monospace",
                fontSize: 13,
              },
              "& textarea": {
                height: "100% !important",
                overflow: "auto !important",
              },
            }}
          />
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {visible.map((entry, i) => {
            const config = typeConfig[entry.type] ?? typeConfig.domain;
            const key = entryKey(entry);
            const included = !excludedSet.has(key);
            return (
              <ListItem
                key={i}
                onClick={editing ? () => toggleEntry(key) : undefined}
                sx={{
                  py: 0.25,
                  minHeight: 28,
                  "&:hover": { bgcolor: "action.hover" },
                  ...(editing && {
                    cursor: "pointer",
                    opacity: included ? 1 : 0.45,
                  }),
                }}
              >
                {editing && (
                  <Checkbox
                    size="small"
                    checked={included}
                    sx={{ p: 0.25, mr: 1 }}
                    slotProps={{
                      input: {
                        "aria-label": `Include ${entry.type} ${entry.value}`,
                      },
                    }}
                  />
                )}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: config.color,
                    mr: 1,
                    minWidth: 24,
                  }}
                  title={config.label}
                >
                  {config.icon}
                </Box>
                <ListItemText
                  primary={entry.value}
                  primaryTypographyProps={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    noWrap: true,
                  }}
                />
              </ListItem>
            );
          })}
          {hasMore && (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setVisibleCount((c) => c + CHUNK_SIZE)}
              >
                Load more ({filtered.length - visibleCount} remaining)
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
