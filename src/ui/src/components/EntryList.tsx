import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  TextField,
} from "@mui/material";

interface Props {
  category: string | null;
  entries: string[];
  filter: string;
  onFilterChange: (value: string) => void;
  loading: boolean;
}

export function EntryList({
  category,
  entries,
  filter,
  onFilterChange,
  loading,
}: Props) {
  const filtered = entries.filter((e) =>
    e.toLowerCase().includes(filter.toLowerCase())
  );

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
              label={`${entries.length} entries`}
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
      <List sx={{ flex: 1, overflow: "auto" }} dense>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : !category ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography color="text.secondary">
              Select a category to view entries
            </Typography>
          </Box>
        ) : (
          filtered.map((entry, i) => (
            <ListItemButton key={i}>
              <ListItemText
                primary={entry}
                primaryTypographyProps={{
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
              />
            </ListItemButton>
          ))
        )}
      </List>
    </Box>
  );
}
