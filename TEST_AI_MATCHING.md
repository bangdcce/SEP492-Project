# 🧪 Test Guide: AI Matching System

## Overview
Hệ thống AI Matching có **4 layers**:
1. **Hard Filter** - Lọc candidates đủ điều kiện (KYC, không quá tải)
2. **Tag Scorer** - Tính điểm skill overlap (0-100)
3. **AI Ranker** - Gemini LLM đánh giá semantic relevance
4. **Classifier** - Phân loại: PERFECT_MATCH, POTENTIAL, HIGH_RISK, NORMAL

---

## 📋 Prerequisites

### Cần có:
1. ✅ **Freelancer account** với skills đã setup (từ signup Step 4)
2. ✅ **CV uploaded** (tăng độ chính xác AI)
3. ✅ **Client account** để tạo project request
4. ✅ **Server đang chạy** (`yarn start:dev`)
5. ✅ **Supabase connected** (fix lỗi ENOTFOUND trước)

---

## 🚀 Test Flow

### **Option 1: Dùng Postman/Thunder Client**

#### Step 1: Login và lấy access token

```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "your-freelancer@email.com",
  "password": "your-password"
}
```

**Response:** Copy `accessToken` từ response

---

#### Step 2: Tạo Project Request (hoặc dùng có sẵn)

**Login as CLIENT first:**
```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "testclient01@interdev.local",
  "password": "Client@123"
}
```

**Tạo mới project request:**
```http
POST http://localhost:3000/project-requests
Authorization: Bearer <CLIENT_ACCESS_TOKEN>
Content-Type: application/json

{
  "title": "Build E-commerce Website",
  "description": "We need a full-stack developer to build an e-commerce platform with React frontend and Node.js backend. Must have experience with PostgreSQL and payment integration.",
  "budgetRange": "50M_100M",
  "intendedTimeline": "2026-06-01",
  "techPreferences": "React, Node.js, PostgreSQL, TypeScript"
}
```

**Response:** Copy `id` của request vừa tạo (ví dụ: `26b6c134-5c6f-4652-a39d-0611865c624c`)

---

#### Step 3: Test AI Matching

**🔥 Full AI Matching (with Gemini LLM):**
```http
GET http://localhost:3000/matching/<REQUEST_ID>?enableAi=true&topN=10&requireKyc=false
Authorization: Bearer <CLIENT_ACCESS_TOKEN>
```

**⚡ Quick Matching (no AI, deterministic only):**
```http
GET http://localhost:3000/matching/<REQUEST_ID>/quick?topN=10&requireKyc=false
Authorization: Bearer <CLIENT_ACCESS_TOKEN>
```

**Query Parameters:**
- `enableAi` (boolean, default: `true`) - Bật/tắt AI Layer 3
- `topN` (number, default: `10`, range: 1-50) - Số candidates gửi cho AI
- `requireKyc` (boolean, default: `true`) - Chỉ lấy freelancer KYC verified
- `role` (enum: `FREELANCER` | `BROKER`, default: `FREELANCER`)

---

#### Step 4: Đọc kết quả

**Response Format:**
```json
{
  "requestId": "26b6c134-5c6f-4652-a39d-0611865c624c",
  "matches": [
    {
      "candidateId": "your-freelancer-id",
      "candidateName": "Nguyen Van A",
      "candidateRole": "FREELANCER",
      "skills": [
        {
          "skillName": "React",
          "priority": "PRIMARY",
          "proficiencyLevel": 8,
          "yearsOfExperience": 3
        }
      ],
      "bio": "Experienced full-stack developer...",
      "scores": {
        "tagOverlap": 85.5,
        "trustScore": 75.0,
        "aiRelevance": 92.3,
        "finalScore": 87.8
      },
      "classification": "PERFECT_MATCH",
      "aiReasoning": "Candidate has 8/10 proficiency in React, 3 years experience, and portfolio demonstrates strong e-commerce projects..."
    }
  ],
  "stats": {
    "totalEligible": 15,
    "afterTagScoring": 10,
    "afterAiRanking": 10,
    "executionTimeMs": 2345
  }
}
```

**Classification Meanings:**
- ✅ **PERFECT_MATCH** (score > 85) - Rất phù hợp, recommend ngay
- 🟡 **POTENTIAL** (score 50-85) - Khá phù hợp, cần review thêm
- 🔴 **HIGH_RISK** (score < 50) - Không phù hợp
- ⚪ **NORMAL** - Default nếu không có AI

---

### **Option 2: Dùng Swagger UI**

1. Mở Swagger: http://localhost:3000/api-docs
2. Authorize với Bearer token (từ login)
3. Tìm section: **Matching Engine**
4. Test endpoint:
   - `GET /matching/{requestId}` - Full AI matching
   - `GET /matching/{requestId}/quick` - Quick matching

---

## 🎯 Test Cases

### Test Case 1: Perfect Match
**Given:**
- Freelancer có skills: React (PRIMARY, proficiency 8), Node.js (PRIMARY, proficiency 9)
- Project cần: React, Node.js, PostgreSQL

**Expected:**
- tagOverlap > 70
- classification = "PERFECT_MATCH" (nếu AI enabled)
- aiReasoning có mention về React + Node.js experience

---

### Test Case 2: Partial Match
**Given:**
- Freelancer có skills: Vue.js (PRIMARY), Python (SECONDARY)
- Project cần: React, Node.js, PostgreSQL

**Expected:**
- tagOverlap < 40
- classification = "HIGH_RISK" hoặc "POTENTIAL"
- aiReasoning explain why not good fit

---

### Test Case 3: No CV vs With CV
**Given:**
- 2 Freelancers cùng skills
- 1 có CV uploaded, 1 không

**Expected:**
- Freelancer có CV nên có aiRelevance cao hơn (AI đọc CV content)

---

## 🔧 Troubleshooting

### Lỗi "No eligible candidates found"
**Nguyên nhân:**
- Không có freelancer nào match skills
- `requireKyc=true` nhưng chưa có ai KYC verified

**Giải pháp:**
- Đổi `requireKyc=false`
- Tạo thêm freelancer account với skills match
- Check database: `SELECT * FROM user_skills WHERE "userId" = 'your-freelancer-id'`

---

### Lỗi "AI ranking failed, falling back to tag scores"
**Nguyên nhân:**
- Gemini API key chưa config
- API limit exceeded

**Giải pháp:**
```env
# Trong server/.env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
```

Get key từ: https://makersuite.google.com/app/apikey

---

### Lỗi "Request not found"
**Nguyên nhân:**
- `requestId` sai
- Request đã bị xóa

**Giải pháp:**
```sql
-- Check có requests gì
SELECT id, title, status FROM project_requests LIMIT 10;
```

---

## 📊 Performance Expectations

**Execution Time:**
- Quick matching (no AI): 50-200ms
- Full AI matching: 1.5-3s (tùy số candidates + LLM response time)

**Score Distribution:**
- tagOverlap: 0-100 (based on skill overlap + proficiency weights)
- trustScore: 0-100 (based on user trust metrics)
- aiRelevance: 0-100 (Gemini LLM semantic scoring)
- finalScore: Weighted average
  - AI enabled: 50% AI + 30% tagOverlap + 20% trustScore
  - AI disabled: 70% tagOverlap + 30% trustScore

---

## 🎓 Advanced Testing

### Test với nhiều freelancers cùng lúc

**Seed data:**
```bash
# Trong server directory
yarn typeorm query -f src/database/seeds/test-accounts-seed.sql
```

Seed file có sẵn:
- 5+ freelancer accounts với skills khác nhau
- 4 project requests với tech stacks khác nhau

---

### Test AI reasoning quality

**So sánh 2 cases:**
1. **Freelancer A:** React PRIMARY (proficiency 9), 5 years exp, CV có mention React projects
2. **Freelancer B:** React SECONDARY (proficiency 5), 1 year exp, no CV

**Expected:**
- A có aiRelevance cao hơn đáng kể (85+ vs 60-)
- A's aiReasoning có cụ thể hơn về experience + portfolio

---

## 📝 Notes

- AI Matching yêu cầu **Gemini API key** để chạy Layer 3
- Nếu không có API key, hệ thống vẫn chạy được với Layer 1,2,4 (deterministic scoring)
- Best practice: Test với `requireKyc=false` trước để có nhiều candidates hơn
- Production: Always use `requireKyc=true` để đảm bảo quality

---

## 🚨 Important

**Database cần có đủ data:**
- ✅ `users` - Freelancer accounts
- ✅ `profiles` - Bio, cvUrl
- ✅ `user_skills` - Skills với priority, proficiency
- ✅ `skills` - Skill master data (React, Node.js, etc.)
- ✅ `project_requests` - Requests với techPreferences

Check bằng:
```sql
-- Count freelancers với skills
SELECT COUNT(DISTINCT us."userId") 
FROM user_skills us 
JOIN users u ON u.id = us."userId" 
WHERE u.role = 'FREELANCER';

-- Count requests
SELECT COUNT(*) FROM project_requests WHERE status IN ('PENDING', 'DRAFT');
```

---

## 📧 Contact

Nếu test không work, check:
1. Server logs: `yarn start:dev` output
2. Database connection: Fix lỗi ENOTFOUND trước
3. Seed data: Run migration + seeds
4. API authentication: Access token còn hạn không

Good luck! 🚀
