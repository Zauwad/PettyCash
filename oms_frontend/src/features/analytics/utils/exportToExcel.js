import * as XLSX from 'xlsx';

/**
 * Export multiple data arrays as separate sheets in an Excel workbook.
 *
 * @param {Array<{ name: string, data: Array<Object> }>} sheets - Array of sheet definitions
 * @param {string} filename - Output filename (without extension)
 */
export function exportToExcel(sheets, filename = 'report') {
  if (!sheets || sheets.length === 0) return;

  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, data }) => {
    if (!data || data.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-width for columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...data.map((row) => String(row[key] ?? '').length)
      ) + 2,
    }));
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, name.substring(0, 31));
  });

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
