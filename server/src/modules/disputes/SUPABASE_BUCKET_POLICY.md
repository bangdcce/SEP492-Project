# 🗂️ SUPABASE BUCKET POLICY - "disputes"

## 📋 BUCKET CONFIGURATION

### 1. Bucket Settings (Dashboard → Storage → disputes)

```
Bucket Name: disputes
Public: FALSE (Private bucket)
File size limit: 52428800 bytes (50MB)
Allowed MIME types:
  - image/jpeg
  - image/png
  - image/gif
  - image/webp
  - application/pdf
  - video/mp4
  - video/webm
  - text/plain
  - application/json
```

---

## � DATABASE SCHEMA REFERENCE

**Bảng `disputes`:**

- `id` (uuid)
- `"raisedById"` (uuid) - Người tạo dispute
- `"defendantId"` (uuid) - Bị đơn
- `status` (enum): `OPEN`, `IN_MEDIATION`, `RESOLVED`, `REJECTED`, `APPEALED`

**Bảng `users`:**

- `id` (uuid)
- `role` (enum): `ADMIN`, `STAFF`, `BROKER`, `CLIENT`, `CLIENT_SME`, `FREELANCER`

---

## 🔐 RLS POLICIES (Row Level Security)

> ⚠️ **HƯỚNG DẪN**: Dùng Dashboard UI để tạo policies
>
> **Đường dẫn:** Storage → disputes (bucket) → Policies tab → New Policy → For full customization

---

### Policy 1: Upload Evidence (INSERT)

**Ai được upload:**

- User là raiser HOẶC defendant của dispute
- HOẶC user có role STAFF/ADMIN
- Dispute phải chưa RESOLVED/REJECTED

**Dashboard UI Settings:**

- **Policy name:** `upload_evidence_policy`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **WITH CHECK expression:**

```sql
bucket_id = 'disputes'
AND EXISTS (
  SELECT 1 FROM public.disputes d
  WHERE d.id::text = split_part(name, '/', 1)
  AND (
    d."raisedById" = auth.uid()
    OR d."defendantId" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('STAFF', 'ADMIN')
    )
  )
  AND d.status IN ('OPEN', 'IN_MEDIATION', 'APPEALED')
)
```

---

### Policy 2: View/Download Evidence (SELECT)

**Ai được xem:**

- User là raiser HOẶC defendant của dispute
- HOẶC user có role STAFF/ADMIN

**Dashboard UI Settings:**

- **Policy name:** `view_evidence_policy`
- **Allowed operation:** `SELECT`
- **Target roles:** `authenticated`
- **USING expression:**

```sql
bucket_id = 'disputes'
AND EXISTS (
  SELECT 1 FROM public.disputes d
  WHERE d.id::text = split_part(name, '/', 1)
  AND (
    d."raisedById" = auth.uid()
    OR d."defendantId" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('STAFF', 'ADMIN')
    )
  )
)
```

---

### Policy 3: Delete Evidence (DELETE) - **BLOCKED**

**⚠️ WORM COMPLIANCE: KHÔNG AI được xóa evidence**

**Dashboard UI Settings:**

- **Policy name:** `no_delete_evidence_policy`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **USING expression:**

```sql
bucket_id = 'disputes' AND false
```

**Giải thích:**

- `bucket_id = 'disputes'` → Chỉ áp dụng cho bucket này (explicit)
- `AND false` → Không ai được phép (absolute block)

---

### Policy 4: Update Evidence (UPDATE) - **BLOCKED**

**⚠️ WORM COMPLIANCE: KHÔNG AI được sửa/ghi đè file**

**Dashboard UI Settings:**

- **Policy name:** `no_update_evidence_policy`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **USING expression:**

```sql
bucket_id = 'disputes' AND false
```

**Giải thích:**

- `bucket_id = 'disputes'` → Chỉ áp dụng cho bucket này (explicit)
- `AND false` → Không ai được phép (absolute block)
- **Scope:** Policy này CHỈ block UPDATE trên bucket "disputes", không ảnh hưởng buckets khác

---

## 📊 SUMMARY: PERMISSION MATRIX

| Action               | Raiser | Defendant | Staff | Admin | Anonymous |
| -------------------- | ------ | --------- | ----- | ----- | --------- |
| Upload (active case) | ✅     | ✅        | ✅    | ✅    | ❌        |
| View (own dispute)   | ✅     | ✅        | ✅    | ✅    | ❌        |
| Delete               | ❌     | ❌        | ❌    | ❌    | ❌        |
| Update/Overwrite     | ❌     | ❌        | ❌    | ❌    | ❌        |

---

## 🔧 IMPLEMENTATION NOTES

### 1. Path Structure

```
disputes/
├── {disputeId-1}/
│   ├── 20260118_143025_a1b2c3d4_screenshot.png
│   ├── 20260118_144530_e5f6g7h8_contract.pdf
│   └── 20260118_150000_i9j0k1l2_video_proof.mp4
├── {disputeId-2}/
│   └── ...
```

### 2. Signed URLs (cho download)

**Không expose permanent URLs. Luôn dùng signed URLs với TTL.**

```typescript
// Generate signed URL (expires in 1 hour)
const { data, error } = await supabase.storage.from('disputes').createSignedUrl(storagePath, 3600); // 3600 seconds = 1 hour
```

### 3. Database Sync

Mỗi file upload phải có record tương ứng trong `dispute_evidences` table:

- `storagePath` = path trong bucket
- `fileHash` = SHA-256 để verify integrity
- `uploadedAt` = timestamp immutable
