import * as XLSX from "xlsx";

/**
 * Export data to CSV file and trigger browser download
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : String(val);
          // Escape commas and quotes
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export data to XLSX file and trigger browser download
 */
export function exportToExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    // Auto-width columns
    const colWidths = Object.keys(sheet.data[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...sheet.data.map((row) => String(row[key] ?? "").length)
      ),
    }));
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format products data for export
 */
export function formatProductsForExport(products: any[]) {
  return products.map((p) => ({
    Nombre: p.name,
    Categoría: p.category || "",
    "Precio Costo": p.costPrice,
    "Precio Venta": p.salePrice,
    Stock: p.stock,
    "Umbral Stock Bajo": p.lowStockThreshold,
    Proveedor: p.supplier || "",
    Moneda: p.currency,
    Notas: p.notes || "",
    "Fecha Creación": new Date(p.createdAt).toLocaleDateString("es"),
  }));
}

/**
 * Format movements data for export
 */
export function formatMovementsForExport(movements: any[]) {
  const typeLabels: Record<string, string> = {
    sale: "Venta",
    restock: "Restock",
    adjustment: "Ajuste",
  };
  return movements.map((m) => ({
    Tipo: typeLabels[m.type] || m.type,
    Producto: m.productName || "",
    Categoría: m.productCategory || "",
    Cantidad: m.quantity,
    "Precio Unitario": m.unitPrice || "",
    "Total Venta": m.unitPrice ? (parseFloat(m.unitPrice) * m.quantity).toFixed(2) : "",
    "Costo Envío": m.shippingCost || "0",
    Moneda: m.currency,
    Notas: m.notes || "",
    Fecha: new Date(m.createdAt).toLocaleDateString("es"),
  }));
}
