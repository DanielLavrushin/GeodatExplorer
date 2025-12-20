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
import { WelcomeScreen } from "./components/WelcomeScreen";
import { FileBrowser } from "./components/FileBrowser";
import { FileState, FileType } from "./types";
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
            <PublicIcon sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              GeodatExplorer
            </Typography>
            {file && (
              <>
                <Typography
                  variant="body2"
                  sx={{ mr: 2, color: "text.secondary" }}
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
              </>
            )}
          </Toolbar>
        </AppBar>

        {file ? (
          <FileBrowser file={file} />
        ) : (
          <WelcomeScreen onOpenFile={handleOpenFile} loading={loading} />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
