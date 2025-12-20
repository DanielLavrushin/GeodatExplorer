import { useState } from "react";
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { geodat } from "../wailsjs/go/models";
import { SearchGeoSite, SearchGeoIP } from "../wailsjs/go/main/App";
import { FileType } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileType: FileType;
  onSelectCategory: (category: string) => void;
}

export function GlobalSearch({
  open,
  onClose,
  filePath,
  fileType,
  onSelectCategory,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<geodat.SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !filePath) return;

    setLoading(true);
    setSearched(true);

    try {
      let data: geodat.SearchResult[] = [];
      if (fileType === "geosite") {
        data = await SearchGeoSite(filePath, query);
      } else if (fileType === "geoip") {
        data = await SearchGeoIP(filePath, query);
      }
      setResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    setQuery("");
    setResults([]);
    setSearched(false);
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
          placeholder={
            fileType === "geosite"
              ? "Search domains (e.g. google.com)"
              : "Search IPs (e.g. 8.8.8)"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSearch} disabled={loading}>
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

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

        {!loading && searched && results.length === 0 && (
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
