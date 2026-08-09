"use client";

import React from "react";
import { ClientInfo, Customer } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";

const NEW_CLIENT = "_new";

interface ClientInfoSectionProps {
  client: ClientInfo;
  onUpdate: (patch: Partial<ClientInfo>) => void;
  customers?: Customer[];
  customerId?: string;
  /** เลือกลูกค้าจาก master (null = กรอกเอง / ยกเลิกการเชื่อม) */
  onSelectCustomer?: (customer: Customer | null) => void;
}

export function ClientInfoSection({
  client,
  onUpdate,
  customers = [],
  customerId,
  onSelectCustomer,
}: ClientInfoSectionProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> ข้อมูลลูกค้า
        </CardTitle>
        <CardDescription>ข้อมูลผู้รับใบเสนอราคา</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onSelectCustomer && customers.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="cl-master">เลือกจากลูกค้าที่มี (optional)</Label>
            <Select
              value={customerId || NEW_CLIENT}
              onValueChange={(v) =>
                onSelectCustomer(v === NEW_CLIENT ? null : customers.find((c) => c.id === v) ?? null)
              }
            >
              <SelectTrigger id="cl-master">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CLIENT}>— กรอกลูกค้าใหม่เอง —</SelectItem>
                {customers.filter((c) => c.active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customerId && (
              <p className="text-[11px] text-emerald-600">
                เชื่อมกับลูกค้าใน master — แก้ข้อมูลได้ที่หน้า “ลูกค้า” แล้วจะอัปเดตทุกที่ให้อัตโนมัติ
              </p>
            )}
          </div>
        )}

        {customerId ? (
          /* ผูก master แล้ว → อ่านอย่างเดียว ดึงจาก master (ไม่ต้องกรอกซ้ำ) */
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm space-y-1">
            <div className="font-bold">{client.name || "—"}</div>
            {client.taxId && <div className="text-[12px] text-muted-foreground">เลขผู้เสียภาษี: {client.taxId}</div>}
            {client.address && <div className="text-[12px] text-muted-foreground whitespace-pre-line">{client.address}</div>}
            {(client.contactPerson || client.contactPhone) && (
              <div className="text-[12px] text-muted-foreground">
                ผู้ติดต่อ: {client.contactPerson || "—"}
                {client.contactPhone && ` • ${client.contactPhone}`}
              </div>
            )}
            {client.contactEmail && <div className="text-[12px] text-muted-foreground">{client.contactEmail}</div>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cl-name">ชื่อบริษัทลูกค้า</Label>
                <Input
                  id="cl-name"
                  value={client.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="บริษัท ลูกค้า จำกัด"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cl-taxid">เลขประจำตัวผู้เสียภาษี</Label>
                <Input
                  id="cl-taxid"
                  value={client.taxId ?? ""}
                  onChange={(e) => onUpdate({ taxId: e.target.value })}
                  maxLength={13}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-address">ที่อยู่</Label>
              <Textarea
                id="cl-address"
                value={client.address ?? ""}
                onChange={(e) => onUpdate({ address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cl-person">ผู้ติดต่อ</Label>
                <Input
                  id="cl-person"
                  value={client.contactPerson ?? ""}
                  onChange={(e) => onUpdate({ contactPerson: e.target.value })}
                  placeholder="คุณสมชาย"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cl-email">อีเมลผู้ติดต่อ</Label>
                <Input
                  id="cl-email"
                  type="email"
                  value={client.contactEmail ?? ""}
                  onChange={(e) => onUpdate({ contactEmail: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cl-phone">เบอร์โทรผู้ติดต่อ</Label>
                <Input
                  id="cl-phone"
                  value={client.contactPhone ?? ""}
                  onChange={(e) => onUpdate({ contactPhone: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
