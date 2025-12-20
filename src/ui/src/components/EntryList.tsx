import { useMemo, useState } from "react";
import {
  Box,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import SearchIcon from "@mui/icons-material/Search";
import CodeIcon from "@mui/icons-material/Code";
import HubIcon from "@mui/icons-material/Hub";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { geodat } from "../wailsjs/go/models";

interface Props {
  category: string | null;
  entries: geodat.Entry[];
  filter: string;
  onFilterChange: (value: string) => void;
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
  entries,
  filter,
  onFilterChange,
  loading,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const filtered = useMemo(() => {
    setVisibleCount(CHUNK_SIZE);
    return entries.filter((e) =>
      e.value.toLowerCase().includes(filter.toLowerCase())
    );
  }, [entries, filter]);

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
            <TextField
              size="small"
              placeholder="Filter entries..."
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              sx={{ ml: "auto", width: 200 }}
            />
          </Stack>
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
      ) : (
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {visible.map((entry, i) => {
            const config = typeConfig[entry.type] ?? typeConfig.domain;
            return (
              <ListItem
                key={i}
                sx={{
                  py: 0.25,
                  minHeight: 28,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
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
