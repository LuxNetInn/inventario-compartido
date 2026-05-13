import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ExportMenuProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
  label?: string;
}

export function ExportMenu({
  onExportCSV,
  onExportExcel,
  disabled = false,
  label = "Exportar",
}: ExportMenuProps) {
  const handleCSV = () => {
    try {
      onExportCSV();
      toast.success("Archivo CSV descargado");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  const handleExcel = () => {
    try {
      onExportExcel();
      toast.success("Archivo Excel descargado");
    } catch {
      toast.error("Error al exportar Excel");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Download className="w-3.5 h-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleCSV} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
