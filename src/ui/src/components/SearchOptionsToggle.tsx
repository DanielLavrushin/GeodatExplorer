import { Stack, ToggleButton, Tooltip } from "@mui/material";
import { SearchOptions } from "../lib/matcher";

interface Props {
  value: SearchOptions;
  onChange: (options: SearchOptions) => void;
}

const buttonSx = {
  px: 0.75,
  py: 0,
  minWidth: 26,
  height: 24,
  border: 0,
  borderRadius: 1,
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1,
  color: "text.secondary",
  "&.Mui-selected": {
    color: "primary.main",
    bgcolor: "action.selected",
  },
};

/** VS Code style `Aa` / `.*` modifiers for a search field. */
export function SearchOptionsToggle({ value, onChange }: Props) {
  return (
    <Stack direction="row" spacing={0.25}>
      <Tooltip title="Match case">
        <ToggleButton
          value="caseSensitive"
          aria-label="Match case"
          size="small"
          sx={buttonSx}
          selected={value.caseSensitive}
          onChange={() =>
            onChange({ ...value, caseSensitive: !value.caseSensitive })
          }
        >
          Aa
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Use regular expression">
        <ToggleButton
          value="regex"
          aria-label="Use regular expression"
          size="small"
          sx={buttonSx}
          selected={value.regex}
          onChange={() => onChange({ ...value, regex: !value.regex })}
        >
          .*
        </ToggleButton>
      </Tooltip>
    </Stack>
  );
}
