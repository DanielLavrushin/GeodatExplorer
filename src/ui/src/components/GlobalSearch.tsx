import { useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
  Divider,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { geodat } from "../wailsjs/go/models";
import { SearchGeoSite, SearchGeoIP } from "../wailsjs/go/main/App";
import { FileType } from "../types";
import { DEFAULT_SEARCH_OPTIONS, SearchOptions } from "../lib/matcher";
import { SearchOptionsToggle } from "./SearchOptionsToggle";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileType: FileType;
  onSelectCategory: (category: string) => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Search failed";
}

function placeholderFor(fileType: FileType, options: SearchOptions): string {
  if (fileType === "geosite") {
    return options.regex
      ? String.raw`Regex over domains (e.g. ^ads?\..*\.com$)`
      : "Search domains (e.g. google.com)";
  }
  return options.regex
    ? String.raw`Regex over CIDRs (e.g. ^10\.)`
    : "Search by IP or CIDR (e.g. 8.8.8.8 or 10.0.0.0/8)";
}

export function GlobalSearch({
  open,
  onClose,
  filePath,
  fileType,
  onSelectCategory,
}: Props) {
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [results, setResults] = useState<geodat.SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (q: string, opts: SearchOptions) => {
    if (!q.trim() || !filePath) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSearched(true);
    setError(null);

    try {
      let data: geodat.SearchResult[] = [];
      if (fileType === "geosite") {
        data = await SearchGeoSite(filePath, q, opts);
      } else if (fileType === "geoip") {
        data = await SearchGeoIP(filePath, q, opts);
      }
      // A toggle can start a second search before the first returns.
      if (requestId !== requestIdRef.current) return;
      setResults(data || []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error(err);
      setResults([]);
      setError(errorMessage(err));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSearch = () => void runSearch(query, options);

  const handleOptionsChange = (next: SearchOptions) => {
    setOptions(next);
    // Keep an existing result set in sync with the modifiers.
    if (searched && query.trim()) void runSearch(query, next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelect = (category: string) => {
    onSelectCategory(category);
    onClose();
  };

  const handleClose = () => {
    requestIdRef.current++;
    setQuery("");
    setResults([]);
    setSearched(false);
    setError(null);
    onClose();
  };

  const totalMatches = results.reduce((acc, r) => acc + r.total, 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SearchIcon />
          <Typography variant="h6">Global Search</Typography>
          <IconButton onClick={handleClose} sx={{ ml: "auto" }} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder={placeholderFor(fileType, options)}
          value={query}
          error={!!error}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          helperText={
            options.regex && fileType === "geoip"
              ? "Regex matches the CIDR text; IP containment is disabled."
              : undefined
          }
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <SearchOptionsToggle
                    value={options}
                    onChange={handleOptionsChange}
                  />
                  <IconButton onClick={handleSearch} disabled={loading}>
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 2 }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                margin: "0 auto",
                border: "3px solid",
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Searching...
            </Typography>
          </Box>
        )}

        {!loading && !error && searched && results.length === 0 && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              No matches found for "{query}"
            </Typography>
          </Box>
        )}

        {!loading && results.length > 0 && (
          <>
            <Box sx={{ mb: 1 }}>
              <Chip
                label={`${totalMatches} matches in ${results.length} categories`}
                size="small"
                color="primary"
              />
            </Box>
            <Divider />
            <List sx={{ maxHeight: 400, overflow: "auto" }}>
              {results.map((result) => (
                <ListItemButton
                  key={result.category}
                  onClick={() => handleSelect(result.category)}
                >
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography fontWeight="bold">
                          {result.category}
                        </Typography>
                        <Chip
                          label={result.total}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {result.matches.map((m) => m.value).join(", ")}
                        {result.total > result.matches.length && "..."}
                      </Typography>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
