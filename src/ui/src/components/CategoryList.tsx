import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";
import { FileState } from "../types/index";

interface Props {
  file: FileState;
  filter: string;
  onFilterChange: (value: string) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  loading: boolean;
}

export function CategoryList({
  file,
  filter,
  onFilterChange,
  selectedCategory,
  onSelectCategory,
  loading,
}: Props) {
  const filtered = file.categories.filter((c) =>
    c.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box
      sx={{
        width: 280,
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ p: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter categories..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <Stack direction="row" spacing={1}>
          <Chip label={file.type} size="small" color="primary" />
          <Chip
            label={`${file.categories.length} categories`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Box>
      <List sx={{ flex: 1, overflow: "auto" }} dense>
        {loading && !selectedCategory ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          filtered.map((cat) => (
            <ListItemButton
              key={cat}
              selected={selectedCategory === cat}
              onClick={() => onSelectCategory(cat)}
            >
              <ListItemText primary={cat} />
            </ListItemButton>
          ))
        )}
      </List>
    </Box>
  );
}
