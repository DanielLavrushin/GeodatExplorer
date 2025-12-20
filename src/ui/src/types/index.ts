export type FileType = "geosite" | "geoip" | null;

export interface FileState {
  path: string;
  type: FileType;
  categories: string[];
}