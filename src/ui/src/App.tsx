import { useState } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Box,
} from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [status] = useState("Ready");

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppBar position="static">
          <Toolbar>
            <PublicIcon sx={{ mr: 2 }} />
            <Typography variant="h6">GeodatExplorer</Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="lg" sx={{ mt: 2, flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            <Typography>Status: {status}</Typography>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
