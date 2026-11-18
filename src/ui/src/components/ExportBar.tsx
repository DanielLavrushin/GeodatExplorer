import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import { geodat } from "../wailsjs/go/models";
import {
  ExportSelectedCategories,
  SaveFileDialog,
} from "../wailsjs/go/main/App";
import { FileState } from "../types/index";
import { SelectFromListDialog } from "./SelectFromListDialog";

export interface ExportState {
  selection: string[];
  setSelection: (categories: string[]) => void;
  excludedByCat: Record<string, string[]>;
  addedByCat: Record<string, geodat.Entry[]>;
}

interface Props {
  file: FileState;
  state: ExportState;
  shownCategories: string[];
  showSelectedOnly: boolean;
  onShowSelectedOnlyChange: (value: boolean) => void;
}

interface Notice {
  severity: "success" | "error";
  text: string;
}

export function ExportBar({
  file,
  state,
  shownCategories,
  showSelectedOnly,
  onShowSelectedOnlyChange,
}: Props) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const count = state.selection.length;

  const addToSelection = (categories: string[]) => {
    state.setSelection(Array.from(new Set([...state.selection, ...categories])));
  };

  const showNotice = (severity: Notice["severity"], text: string) => {
    setNotice({ severity, text });
    setNoticeOpen(true);
  };

  const handleExport = async () => {
    if (count === 0) return;
    setExporting(true);
    try {
      const defaultName = file.type === "geoip" ? "geoip.dat" : "geosite.dat";
      const savePath = await SaveFileDialog(defaultName);
      if (!savePath) return;
      await ExportSelectedCategories(
        file.path,
        savePath,
        file.type ?? "",
        state.selection,
        state.excludedByCat,
        state.addedByCat,
      );
      showNotice(
        "success",
        `Exported ${count} ${count === 1 ? "category" : "categories"} to ${savePath}`,
      );
    } catch (err) {
      showNotice(
        "error",
        `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  const closeMenu = () => setMenuAnchor(null);

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", px: 1, py: 0.75 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Button
          size="small"
          color="inherit"
          endIcon={<ArrowDropDownIcon />}
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ textTransform: "none" }}
        >
          {count} selected
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={count === 0 || exporting}
          startIcon={
            exporting ? <CircularProgress size={14} color="inherit" /> : undefined
          }
          onClick={handleExport}
          sx={{ textTransform: "none" }}
        >
          Export…
        </Button>
      </Stack>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setListOpen(true);
            closeMenu();
          }}
        >
          <ListItemIcon />
          <ListItemText>Select from a list…</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onShowSelectedOnlyChange(!showSelectedOnly);
            closeMenu();
          }}
        >
          <ListItemIcon>
            {showSelectedOnly && <CheckIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>Show selected only</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={shownCategories.length === 0}
          onClick={() => {
            addToSelection(shownCategories);
            closeMenu();
          }}
        >
          <ListItemIcon />
          <ListItemText>Select all shown ({shownCategories.length})</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={count === 0}
          onClick={() => {
            state.setSelection([]);
            closeMenu();
          }}
        >
          <ListItemIcon />
          <ListItemText>Clear selection</ListItemText>
        </MenuItem>
      </Menu>

      <SelectFromListDialog
        open={listOpen}
        onClose={() => setListOpen(false)}
        availableCategories={file.categories}
        fileType={file.type}
        onSelect={addToSelection}
      />

      <Snackbar
        open={noticeOpen}
        autoHideDuration={notice?.severity === "success" ? 6000 : null}
        onClose={(_, reason) => reason !== "clickaway" && setNoticeOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={notice?.severity ?? "success"}
          variant="filled"
          onClose={() => setNoticeOpen(false)}
          sx={{ wordBreak: "break-word" }}
        >
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}
