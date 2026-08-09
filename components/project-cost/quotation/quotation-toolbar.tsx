"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Eye, EyeOff, FileSpreadsheet } from "lucide-react";

interface QuotationToolbarProps {
  showDetailedLabor: boolean;
  onToggleDetailedLabor: () => void;
  onPrint: () => void;
  onExportExcel: () => void;
}

export function QuotationToolbar({
  showDetailedLabor,
  onToggleDetailedLabor,
  onPrint,
  onExportExcel,
}: QuotationToolbarProps) {
  return (
    <Card className="border-border/50 bg-card/50 print:hidden">
      <CardContent className="pt-4 pb-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={onToggleDetailedLabor}>
            {showDetailedLabor ? (
              <>
                <EyeOff className="h-4 w-4" /> ซ่อนรายละเอียดค่าแรง
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> แสดงรายละเอียดค่าแรง
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            ปรับชื่อบริษัท/ลูกค้า/เลขที่ ได้ที่ &ldquo;ตั้งค่าใบเสนอราคา&rdquo;
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onExportExcel} className="gap-2 h-9 font-semibold">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={onPrint} className="gap-2 h-9 font-semibold">
            <Printer className="h-4 w-4" /> พิมพ์ / บันทึก PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
