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

  // Таблица соответствия: нижний_регистр -> оригинальное_название в .dat файле
  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of availableCategories) {
      map.set(cat.toLowerCase(), cat);
    }
    return map;
  }, [availableCategories]);

  // Сверяем введенный список с категориями открытого файла
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
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText((prev) => (prev ? `${prev}\n${text}` : text));
      }
    } catch {
      alert("Не удалось прочитать буфер обмена. Нажмите Ctrl+V в текстовом поле.");
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
        Выбор категорий по списку ({fileType?.toUpperCase()})
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentPasteIcon />}
              onClick={handlePasteClipboard}
            >
              Вставить из буфера
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Загрузить .txt
            </Button>
            <Button
              variant="text"
              size="small"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setRawText("")}
              disabled={!rawText}
            >
              Очистить
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
            label="Список категорий (через строку, запятую или из конфига Xray)"
            placeholder={
              'Например:\nru, private\n"geosite:youtube"\n"geosite:google"\n"geosite:category-ads-all"'
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
              Найдено в файле ({matched.length} из {availableCategories.length}):
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
                Введите или загрузите список категорий
              </Typography>
            )}
          </Box>

          {missing.length > 0 && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              <Typography variant="caption" fontWeight="bold" display="block">
                Не найдено в открытом файле ({missing.length}):
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
          Отмена
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
            + Добавить к выбранным
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
            Отметить только эти ({matched.length})
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
            Экспорт ({matched.length})
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}