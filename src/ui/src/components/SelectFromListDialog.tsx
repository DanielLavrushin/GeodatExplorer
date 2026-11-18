import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { FileType } from "../types/index";

interface Props {
  open: boolean;
  onClose: () => void;
  availableCategories: string[];
  fileType: FileType;
  onSelect: (categories: string[]) => void;
}

const CATEGORY_REF = /\b(geosite|geoip):([^\s"'`,;:[\]{}()@]+)/gi;

const PLACEHOLDER: Record<string, string> = {
  geosite: 'Paste category names or part of an Xray config, e.g.\ngoogle, youtube\n"geosite:category-ads-all"',
  geoip: 'Paste category names or part of an Xray config, e.g.\nru, private\n"geoip:cn"',
};

function stripComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "#" || (ch === "/" && line[i + 1] === "/")) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseInput(rawText: string, fileType: FileType) {
  const names: string[] = [];
  const skipped: string[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    const refs = [...line.matchAll(CATEGORY_REF)];
    if (refs.length > 0) {
      for (const [, kind, name] of refs) {
        if (!fileType || kind.toLowerCase() === fileType) {
          names.push(name);
        } else {
          skipped.push(`${kind.toLowerCase()}:${name.toLowerCase()}`);
        }
      }
      continue;
    }
    if (line.includes(":")) continue;
    for (const token of line.split(/[\s,;"'`[\]{}()]+/)) {
      names.push(token.replace(/@.*$/, ""));
    }
  }
  const unique = (list: string[]) =>
    Array.from(new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  return { names: unique(names), skipped: unique(skipped) };
}

export function SelectFromListDialog({
  open,
  onClose,
  availableCategories,
  fileType,
  onSelect,
}: Props) {
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of availableCategories) {
      map.set(cat.toLowerCase(), cat);
    }
    return map;
  }, [availableCategories]);

  const { found, missing, skipped } = useMemo(() => {
    const { names, skipped } = parseInput(rawText, fileType);
    const found: string[] = [];
    const missing: string[] = [];
    for (const name of names) {
      const cat = categoryLookup.get(name);
      if (cat) {
        found.push(cat);
      } else {
        missing.push(name);
      }
    }
    return { found, missing, skipped };
  }, [rawText, categoryLookup, fileType]);

  const otherFile = fileType === "geoip" ? "geosite.dat" : "geoip.dat";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    e.target.value = "";
    if (!uploaded) return;
    uploaded.text().then(setRawText, () => {});
  };

  const handleSelect = () => {
    onSelect(found);
    setRawText("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select categories from a list</DialogTitle>
      <DialogContent dividers>
        <TextField
          multiline
          fullWidth
          autoFocus
          minRows={6}
          maxRows={12}
          placeholder={PLACEHOLDER[fileType ?? "geosite"]}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 13 } } }}
        />
        <Button
          size="small"
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mt: 1, textTransform: "none" }}
        >
          Load from file…
        </Button>
        <input
          type="file"
          accept=".txt,.json,.jsonc,text/plain,application/json"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        {rawText.trim() && (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Found {found.length} of {availableCategories.length}
              </Typography>
              {found.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 0.5,
                    maxHeight: 110,
                    overflowY: "auto",
                  }}
                >
                  {found.map((cat) => (
                    <Chip key={cat} label={cat} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
            </Box>
            {missing.length > 0 && (
              <Typography variant="body2" color="warning.main">
                Not in this file: {missing.join(", ")}
              </Typography>
            )}
            {skipped.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Skipped {skipped.join(", ")}: {skipped.length === 1 ? "it refers" : "they refer"} to{" "}
                {otherFile}, not this file.
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={found.length === 0}
          onClick={handleSelect}
        >
          Select {found.length}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
