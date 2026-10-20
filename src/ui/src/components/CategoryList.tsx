import { useMemo, useState } from "react";
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
  Button,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SortIcon from "@mui/icons-material/Sort";
import FilterListIcon from "@mui/icons-material/FilterList";
import { FileState } from "../types/index";
import { geodat } from "../wailsjs/go/models";
import { SearchOptions } from "../lib/matcher";
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
  excludedByCat: Record<string, string[]>;
  addedByCat: Record<string, geodat.Entry[]>;
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
  excludedByCat,
  addedByCat,
  searchButton,
}: Props) {
  const { indices, error: filterError } = useSafeFilter(
    file.categories,
    filter,
    searchOptions,
  );

  const [checkedCategories, setCheckedCategories] = useState<string[]>([]);
  const [sortSelectedFirst, setSortSelectedFirst] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [exporting, setExporting] = useState(false);

  const checkedSet = useMemo(() => new Set(checkedCategories), [checkedCategories]);

  const filtered = useMemo(() => {
    let base = indices
      ? Array.from(indices, (i) => file.categories[i])
      : file.categories;

    if (showOnlySelected) {
      base = base.filter((cat) => checkedSet.has(cat));
    } else if (sortSelectedFirst) {
      base = [...base].sort((a, b) => {
        const aChecked = checkedSet.has(a) ? 0 : 1;
        const bChecked = checkedSet.has(b) ? 0 : 1;
        return aChecked - bChecked;
      });
    }

    return base;
  }, [indices, file.categories, showOnlySelected, sortSelectedFirst, checkedSet]);

  const handleToggle = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSelectAllFiltered = () => {
    setCheckedCategories((prev) => Array.from(new Set([...prev, ...filtered])));
  };

  const handleClearSelection = () => {
    setCheckedCategories([]);
    setShowOnlySelected(false);
  };

  const handleExport = async () => {
    if (checkedCategories.length === 0) return;
    try {
      setExporting(true);
      const defaultName = file.type === "geoip" ? "geoip.dat" : "geosite.dat";

      const app = (window as any).go?.main?.App;
      if (!app) {
        throw new Error("Wails runtime недоступен");
      }

      const savePath = await app.SaveFileDialog(defaultName);
      if (!savePath) {
        setExporting(false);
        return;
      }

      await app.ExportSelectedCategories(
        file.path,
        savePath,
        file.type,
        checkedCategories,
        excludedByCat,
        addedByCat,
      );
      alert(`Успешно экспортировано категорий: ${checkedCategories.length}\nФайл сохранён в:\n${savePath}`);
    } catch (err: any) {
      alert(`Ошибка при экспорте: ${err?.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box
      sx={{
        width: 320,
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

      <Box sx={{ px: 1, pb: 1 }}>
        <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} alignItems="center">
          <Button size="small" variant="text" onClick={handleSelectAllFiltered}>
            Все
          </Button>
          <Button size="small" variant="text" color="inherit" onClick={handleClearSelection}>
            Сброс
          </Button>
          <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
            <Tooltip title="Выбранные наверх">
              <Button
                size="small"
                variant={sortSelectedFirst ? "contained" : "outlined"}
                onClick={() => setSortSelectedFirst((v) => !v)}
                sx={{ minWidth: 32, px: 1 }}
              >
                <SortIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Показать только выбранные">
              <Button
                size="small"
                variant={showOnlySelected ? "contained" : "outlined"}
                onClick={() => setShowOnlySelected((v) => !v)}
                sx={{ minWidth: 32, px: 1 }}
              >
                <FilterListIcon fontSize="small" />
              </Button>
            </Tooltip>
          </Box>
        </Stack>
        <Button
          fullWidth
          size="small"
          variant="contained"
          color="success"
          startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
          disabled={checkedCategories.length === 0 || exporting}
          onClick={handleExport}
        >
          Экспорт ({checkedCategories.length})
        </Button>
      </Box>

      <List sx={{ flex: 1, overflow: "auto" }} dense>
        {loading && !selectedCategory ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          filtered.map((cat) => {
            const isModified =
              (excludedByCat[cat]?.length ?? 0) > 0 ||
              (addedByCat[cat]?.length ?? 0) > 0;
            return (
              <ListItemButton
                key={cat}
                selected={selectedCategory === cat}
                onClick={() => onSelectCategory(cat)}
              >
                <Checkbox
                  edge="start"
                  size="small"
                  checked={checkedSet.has(cat)}
                  tabIndex={-1}
                  disableRipple
                  onClick={(e) => handleToggle(cat, e)}
                  sx={{ mr: 0.5, p: 0.5 }}
                />
                <ListItemText
                  primary={
                    cat.length === 2
                      ? `${String.fromCodePoint(...[...cat.toUpperCase()].map((c) => 0x1f1e6 + (c.codePointAt(0) ?? 65) - 65))} ${cat.toUpperCase()}${isModified ? " *" : ""}`
                      : `🏷️ ${cat}${isModified ? " *" : ""}`
                  }
                  slotProps={{ primary: { sx: { fontFamily: "monospace" } } }}
                />
              </ListItemButton>
            );
          })
        )}
      </List>
    </Box>
  );
}