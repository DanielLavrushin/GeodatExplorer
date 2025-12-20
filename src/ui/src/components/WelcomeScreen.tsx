import { Box, Button, Typography, Paper } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PublicIcon from "@mui/icons-material/Public";

interface Props {
  onOpenFile: () => void;
  loading: boolean;
}

export function WelcomeScreen({ onOpenFile, loading }: Props) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        sx={{
          p: 6,
          textAlign: "center",
          maxWidth: 400,
        }}
        elevation={3}
      >
        <PublicIcon sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          GeodatExplorer
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Browse and explore v2ray geosite and geoip DAT files
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<FolderOpenIcon />}
          onClick={onOpenFile}
          disabled={loading}
        >
          Open DAT File
        </Button>
      </Paper>
    </Box>
  );
}
