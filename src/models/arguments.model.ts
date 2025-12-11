export interface RowData {
  [key: string]: number | string | boolean | Date | Error;
}

export interface Labels {
  [key: string]: string;
}

export interface SheetData {
  title: string;
  labels?: Labels;
  rows: RowData[];
}

export interface ExcelData {
  sheets: SheetData[];
  title?: string;
  fileTitle?: string;
}
