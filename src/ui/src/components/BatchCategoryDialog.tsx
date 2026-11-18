import React, { useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Chip,
  Box,
  Alert,
  Divider,
} from "@mui/material";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

interface Props {
  open: boolean;
  onClose: () => void;
  availableCategories: string[];
  fileType: string | null;
  onApplySelection: (categories: string[], replace: boolean) => void;
  onDirectExport: (categories: string[]) => void;
}

// geosite:google, geoip:ru@attr, ... as written in an Xray config.
const CATEGORY_REF = /\b(geosite|geoip):([^\s"'`,;:[\]{}()@]+)/gi;

/**
 * Extracts category names from pasted text: a plain list separated by
 * newlines, commas, semicolons or spaces, or fragments of an Xray config.
 * Comments (# and //) are stripped from each whole line first. A line with
 * geosite:/geoip: references contributes only references of the open file's
 * type; any other line containing ":" is config syntax and is ignored.
 */
function parseInputTokens(rawText: string, fileType: string | null): string[] {
  const tokens: string[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$|#.*$/, "");
    const refs = [...line.matchAll(CATEGORY_REF)];
    if (refs.length > 0) {
      for (const [, kind, name] of refs) {
        if (!fileType || kind.toLowerCase() === fileType) tokens.push(name);
      }
      continue;
    }
    if (line.includes(":")) continue;
    for (const token of line.split(/[\s,;"'`[\]{}()]+/)) {
      tokens.push(token.replace(/@.*$/, ""));
    }
  }
  return Array.from(
    new Set(tokens.map((t) => t.trim().toLowerCase()).filter(Boolean)),
  );
}

export function BatchCategoryDialog({
  open,
  onClose,
  availableCategories,
  fileType,
  onApplySelection,
  onDirectExport,
}: Props) {
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [clipboardError, setClipboardError] = useState(false);

  // Lower-cased name -> category name as listed for the open file
  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of availableCategories) {
      map.set(cat.toLowerCase(), cat);
    }
    return map;
  }, [availableCategories]);

  // Match the parsed names against the open file's categories
  const { matched, missing } = useMemo(() => {
    const parsedLower = parseInputTokens(rawText, fileType);
    const matchedList: string[] = [];
    const missingList: string[] = [];

    for (const token of parsedLower) {
      const orig = categoryLookup.get(token);
      if (orig) {
        matchedList.push(orig);
      } else {
        missingList.push(token);
      }
    }

    return { matched: matchedList, missing: missingList };
  }, [rawText, categoryLookup, fileType]);

  const handlePasteClipboard = async () => {
    setClipboardError(false);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText((prev) => (prev ? `${prev}\n${text}` : text));
      }
    } catch {
      setClipboardError(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setRawText(content);
      }
    };
    reader.readAsText(uploaded, "utf-8");
    e.target.value = "";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Select categories from a list ({fileType?.toUpperCase()})
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {clipboardError && (
            <Alert severity="warning" onClose={() => setClipboardError(false)}>
              Could not read the clipboard. Paste with Ctrl+V in the text field
              instead.
            </Alert>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentPasteIcon />}
              onClick={handlePasteClipboard}
            >
              Paste from clipboard
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Load file
            </Button>
            <Button
              variant="text"
              size="small"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setRawText("")}
              disabled={!rawText}
            >
              Clear
            </Button>
            <input
              type="file"
              accept=".txt,text/plain,.json,.jsonc"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </Stack>

          <TextField
            label="Categories (one per line, comma-separated, or an Xray config)"
            placeholder={
              'For example:\nru, private\n"geosite:youtube"\n"geosite:google"\n"geosite:category-ads-all"'
            }
            multiline
            rows={7}
            fullWidth
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <Divider />

          <Box>
            <Typography variant="subtitle2" color="success.main" gutterBottom>
              Found in this file ({matched.length} of {availableCategories.length}):
            </Typography>
            {matched.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.5,
                  maxHeight: 110,
                  overflowY: "auto",
                  p: 0.5,
                }}
              >
                {matched.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Type, paste or load a list of categories
              </Typography>
            )}
          </Box>

          {missing.length > 0 && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              <Typography variant="caption" fontWeight="bold" display="block">
                Not found in this file ({missing.length}):
              </Typography>
              <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                {missing.join(", ")}
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" size="small">
          Cancel
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            disabled={matched.length === 0}
            onClick={() => {
              onApplySelection(matched, false);
              onClose();
            }}
          >
            + Add to checked
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<CheckBoxIcon />}
            disabled={matched.length === 0}
            onClick={() => {
              onApplySelection(matched, true);
              onClose();
            }}
          >
            Check only these ({matched.length})
          </Button>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<FileDownloadIcon />}
            disabled={matched.length === 0}
            onClick={() => {
              onDirectExport(matched);
              onClose();
            }}
          >
            Export ({matched.length})
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}