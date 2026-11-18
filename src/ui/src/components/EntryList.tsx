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
  Select,
  MenuItem,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import SearchIcon from "@mui/icons-material/Search";
import CodeIcon from "@mui/icons-material/Code";
import HubIcon from "@mui/icons-material/Hub";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SortIcon from "@mui/icons-material/Sort";
import EditNoteIcon from "@mui/icons-material/EditNote";
import AddIcon from "@mui/icons-material/Add";
import { geodat } from "../wailsjs/go/models";
import { SearchOptions } from "../lib/matcher";
import { useDebounced } from "../lib/useDebounced";
import { useSafeFilter } from "../lib/useSafeFilter";
import { SearchOptionsToggle } from "./SearchOptionsToggle";
import { FileType } from "../types";
import { entryKey } from "../lib/entryKey";

interface Props {
  category: string | null;
  fileType: FileType;
  entries: geodat.Entry[];
  /** entryKey() of every unchecked rule. */
  excludedKeys: string[];
  onChangeExcluded: (excludedKeys: string[]) => void;
  onAddEntry: (entry: geodat.Entry) => void;
  /** scopeKeys: entryKey() of every rule the editor showed. */
  onApplyTextList: (lines: string[], scopeKeys: string[]) => void;
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
  excludedKeys,
  onChangeExcluded,
  onAddEntry,
  onApplyTextList,
  filter,
  onFilterChange,
  searchOptions,
  onSearchOptionsChange,
  loading,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [sortCheckedFirst, setSortCheckedFirst] = useState(false);
  const [showOnlyChecked, setShowOnlyChecked] = useState(false);

  // Поля для добавления нового сайта/IP
  const [newEntryType, setNewEntryType] = useState("domain");
  const [newEntryValue, setNewEntryValue] = useState("");

  // Текстовый режим редактирования
  const [textMode, setTextMode] = useState(false);
  const [rawText, setRawText] = useState("");
  // entryKey() of the rules shown in the editor when it was opened.
  const [textScope, setTextScope] = useState<string[]>([]);

  useEffect(() => {
    setNewEntryType(fileType === "geoip" ? "cidr" : "domain");
    setTextMode(false);
  }, [category, fileType]);

  const excludedSet = useMemo(() => new Set(excludedKeys), [excludedKeys]);

  // A category can hold tens of thousands of entries, so wait for a pause in
  // typing before re-scanning them all.
  const debouncedFilter = useDebounced(filter, 150);
  const values = useMemo(() => entries.map((e) => e.value), [entries]);
  const { indices, error: filterError } = useSafeFilter(
    values,
    debouncedFilter,
    searchOptions,
  );

  const filtered = useMemo(() => {
    let list = indices ? Array.from(indices, (i) => entries[i]) : entries;

    if (showOnlyChecked) {
      list = list.filter((e) => !excludedSet.has(entryKey(e)));
    } else if (sortCheckedFirst) {
      list = [...list].sort((a, b) => {
        const aChecked = excludedSet.has(entryKey(a)) ? 1 : 0;
        const bChecked = excludedSet.has(entryKey(b)) ? 1 : 0;
        return aChecked - bChecked;
      });
    }

    return list;
  }, [indices, entries, showOnlyChecked, sortCheckedFirst, excludedSet]);

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [filtered]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const activeCount = entries.length - excludedSet.size;

  const handleToggleEntry = (key: string) => {
    if (excludedSet.has(key)) {
      onChangeExcluded(excludedKeys.filter((k) => k !== key));
    } else {
      onChangeExcluded([...excludedKeys, key]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredKeys = new Set(filtered.map(entryKey));
    onChangeExcluded(excludedKeys.filter((k) => !filteredKeys.has(k)));
  };

  const handleUnselectAllFiltered = () => {
    const toExclude = new Set(excludedKeys);
    for (const e of filtered) {
      toExclude.add(entryKey(e));
    }
    onChangeExcluded(Array.from(toExclude));
  };

  const handleAddSubmit = () => {
    const trimmed = newEntryValue.trim();
    if (!trimmed) return;
    onAddEntry({
      type: fileType === "geoip" ? "cidr" : newEntryType,
      value: trimmed,
    } as geodat.Entry);
    setNewEntryValue("");
  };

  // Формируем строки для текстового режима с учётом текущего фильтра поиска
  const activeFilteredEntries = useMemo(
    () => filtered.filter((e) => !excludedSet.has(entryKey(e))),
    [filtered, excludedSet],
  );

  // The editor works on a snapshot taken when it opens: later filter changes
  // must neither overwrite the draft nor change which rules Apply affects.
  const handleOpenTextMode = () => {
    const lines = activeFilteredEntries.map((e) =>
      fileType === "geosite" && e.type !== "domain" ? entryKey(e) : e.value,
    );
    setRawText(lines.join("\n"));
    setTextScope(activeFilteredEntries.map(entryKey));
    setTextMode(true);
  };

  const handleSaveTextMode = () => {
    onApplyTextList(rawText.split("\n"), textScope);
    setTextMode(false);
  };

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
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {category}
            </Typography>
            <Chip
              label={`Выбрано: ${activeCount} / ${entries.length}`}
              size="small"
              color={activeCount < entries.length ? "warning" : "primary"}
              variant="outlined"
            />
            <Button
              size="small"
              variant={textMode ? "contained" : "outlined"}
              startIcon={<EditNoteIcon />}
              onClick={() => (textMode ? handleSaveTextMode() : handleOpenTextMode())}
            >
              {textMode ? "Применить текст" : "Режим текста"}
            </Button>
            {textMode && (
              <Button size="small" color="inherit" onClick={() => setTextMode(false)}>
                Отмена
              </Button>
            )}

            <Tooltip title={filterError ?? ""} placement="bottom-end">
              <TextField
                size="small"
                placeholder={
                  searchOptions.regex ? "Filter by regex..." : "Filter entries..."
                }
                value={filter}
                disabled={textMode}
                error={!!filterError}
                onChange={(e) => onFilterChange(e.target.value)}
                sx={{ ml: "auto", width: 260 }}
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

          {!textMode && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Button size="small" variant="text" onClick={handleSelectAllFiltered}>
                Отметить все
              </Button>
              <Button size="small" variant="text" color="inherit" onClick={handleUnselectAllFiltered}>
                Снять все
              </Button>
              <Button
                size="small"
                variant={sortCheckedFirst ? "contained" : "outlined"}
                startIcon={<SortIcon />}
                onClick={() => setSortCheckedFirst((v) => !v)}
              >
                Выбранные сверху
              </Button>
              <Button
                size="small"
                variant={showOnlyChecked ? "contained" : "outlined"}
                onClick={() => setShowOnlyChecked((v) => !v)}
              >
                Только выбранные
              </Button>

              <Stack direction="row" spacing={0.5} sx={{ ml: "auto" }} alignItems="center">
                {fileType === "geosite" && (
                  <Select
                    size="small"
                    value={newEntryType}
                    onChange={(e) => setNewEntryType(e.target.value)}
                    sx={{ height: 32, fontSize: 13 }}
                  >
                    <MenuItem value="domain">domain</MenuItem>
                    <MenuItem value="full">full</MenuItem>
                    <MenuItem value="keyword">keyword</MenuItem>
                    <MenuItem value="regexp">regexp</MenuItem>
                  </Select>
                )}
                <TextField
                  size="small"
                  placeholder={fileType === "geoip" ? "Добавить IP/CIDR..." : "Добавить сайт..."}
                  value={newEntryValue}
                  onChange={(e) => setNewEntryValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                  sx={{ width: 200 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddSubmit}
                >
                  Добавить
                </Button>
              </Stack>
            </Stack>
          )}
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
        <Box sx={{ flex: 1, p: 1.5, display: "flex", flexDirection: "column" }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
            Показано строк по фильтру: <b>{textScope.length}</b>. По одной записи на строку. Для geosite можно указывать префикс (например: <code>full:example.com</code>, <code>regexp:.*test.*</code> или просто <code>example.com</code>).
          </Typography>
          <TextField
            multiline
            fullWidth
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
            const isChecked = !excludedSet.has(key);
            return (
              <ListItem
                key={`${key}-${i}`}
                onClick={() => handleToggleEntry(key)}
                sx={{
                  py: 0.25,
                  minHeight: 28,
                  cursor: "pointer",
                  opacity: isChecked ? 1 : 0.45,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Checkbox
                  size="small"
                  checked={isChecked}
                  sx={{ p: 0.25, mr: 1 }}
                  slotProps={{
                    input: { "aria-label": `Include ${entry.type} ${entry.value}` },
                  }}
                />
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
