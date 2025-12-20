import { useState } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import CloseIcon from "@mui/icons-material/Close";
import GitHubIcon from "@mui/icons-material/GitHub";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { FileBrowser } from "./components/FileBrowser";
import { FileState, FileType } from "./types";
import { BrowserOpenURL } from "./wailsjs/runtime/runtime";
import {
  OpenFileDialog,
  ListGeoSiteCategories,
  ListGeoIPCategories,
} from "./wailsjs/go/main/App";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [file, setFile] = useState<FileState | null>(null);
  const [loading, setLoading] = useState(false);

  const detectFileType = (path: string): FileType => {
    const lower = path.toLowerCase();
    if (lower.includes("geosite")) return "geosite";
    if (lower.includes("geoip")) return "geoip";
    return null;
  };

  const handleOpenFile = async () => {
    try {
      const path = await OpenFileDialog("Select GeoDAT file");
      if (!path) return;

      setLoading(true);

      const type = detectFileType(path);
      let categories: string[] = [];

      if (type === "geosite") {
        categories = await ListGeoSiteCategories(path);
      } else if (type === "geoip") {
        categories = await ListGeoIPCategories(path);
      }

      setFile({
        path,
        type,
        categories: categories || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseFile = () => {
    setFile(null);
  };

  const fileName = file?.path.split("/").pop() || "";

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppBar position="static">
          <Toolbar variant="dense">
            <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
              <PublicIcon sx={{ mr: 1, mb: 0.5, fontSize: 30 }} />
              <Typography variant="h6">GEODAT EXPLORER</Typography>
            </Box>
            {file && (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography
                  variant="body2"
                  sx={{ mr: 1, color: "text.secondary" }}
                >
                  {fileName}
                </Typography>
                <Tooltip title="Close file">
                  <IconButton
                    color="inherit"
                    onClick={handleCloseFile}
                    size="small"
                  >
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {file ? (
          <FileBrowser file={file} />
        ) : (
          <WelcomeScreen onOpenFile={handleOpenFile} loading={loading} />
        )}
        <Box
          component="footer"
          sx={{
            py: 1,
            px: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 0.5,
            cursor: "pointer",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 2 }}
          >
            Developed by Daniel Lavrushin
          </Typography>
          <GitHubIcon
            sx={{
              mb: 0.5,
              fontSize: 14,
              color: "text.secondary",
              cursor: "pointer",
            }}
            onClick={() =>
              BrowserOpenURL(
                "https://github.com/daniellavrushin/geodatexplorer"
              )
            }
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
