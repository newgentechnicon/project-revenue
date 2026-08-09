# Project Revenue

ระบบบริหารรายได้แบบหลายบริษัท (multi-tenant) โดยใช้ Supabase Auth + Postgres RLS

## การตั้งค่า

1. คัดลอก `.env.local.example` เป็น `.env.local`
2. ตั้งค่า `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` และ
   `SUPABASE_SECRET_KEY` โดยคัดลอก Secret key (`sb_secret_...`) จาก Supabase Dashboard
   ที่ Settings → API Keys (คีย์สุดท้ายใช้บน server เท่านั้น ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_`)
   ระบบยังรองรับ `SUPABASE_SERVICE_ROLE_KEY` แบบเดิมเป็น fallback
3. รัน migration ใน `supabase/migrations` ตามลำดับจนถึง `0011_organization_selector.sql`
4. บัญชี Owner เดิมจะถูกเพิ่มเป็น Platform Admin ใน migration 0010 หากฐานข้อมูลยังไม่มี Owner
   ให้สร้างบัญชี Platform Admin แรกใน Supabase Auth Dashboard แล้วรัน SQL นี้หนึ่งครั้ง:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

5. เข้า `/admin/organizations` เพื่อสร้างบริษัทก่อน แล้วจึงสร้างบัญชีผู้ใช้ของบริษัทนั้น

ผู้ใช้ทั่วไปไม่มีหน้าสมัครบัญชีเอง บัญชีหนึ่งอยู่ได้หลายบริษัท และต้องเลือก Organization ก่อนใช้งาน
ทุกครั้งตาม flow `Login → Organization → ระบบ → หน้าทำงาน` ข้อมูลธุรกิจถูกกรองด้วย `org_id`
ผ่าน Row Level Security ตาม Organization ที่เลือกอยู่

## Development

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
