import * as XLSX from 'xlsx';

export function exportToExcel(params: {
  sheetName: string;
  filename: string;
  rows: Record<string, string | number>[];
}): void {
  const worksheet = XLSX.utils.json_to_sheet(params.rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, params.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${params.filename}.xlsx`);
}
