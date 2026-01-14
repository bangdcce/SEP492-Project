# TrustProfileSection Integration Guide

Hướng dẫn tích hợp component `TrustProfileSection` vào trang của bạn.

---

## 1. Import Component

```tsx
import { TrustProfileSection } from "@/features/trust-profile/sections/TrustProfileSection";
import type { User, Review } from "@/features/trust-profile/types";
```

---

## 2. Chuẩn bị Data

### User Object (bắt buộc)

```tsx
const user: User = {
  id: "user-uuid",
  fullName: "Trần Thị Freelancer",
  avatarUrl: "https://example.com/avatar.jpg",
  isVerified: true,
  currentTrustScore: 4.8,
  badge: "TRUSTED", // "NEW" | "VERIFIED" | "TRUSTED" | "WARNING" | "NORMAL"
  stats: {
    finished: 15, // Số dự án hoàn thành
    disputes: 0, // Số tranh chấp thua
    score: 4.8, // Điểm uy tín
  },
};
```

### Reviews Array (bắt buộc)

```tsx
const reviews: Review[] = [
  {
    id: "review-uuid",
    rating: 5, // 1-5
    comment: "Nội dung đánh giá...",
    weight: 2.0, // Trọng số của review
    createdAt: "2024-12-01T10:00:00Z",
    updatedAt: "2024-12-01T10:00:00Z",
    reviewer: {
      id: "reviewer-uuid",
      fullName: "Nguyễn Văn A",
      avatarUrl: "https://example.com/avatar.jpg",
      badge: "VERIFIED",
    },
    project: {
      id: "project-uuid",
      title: "Tên dự án",
      totalBudget: 50000000,
      status: "COMPLETED",
    },
  },
  // ... thêm reviews khác
];
```

---

## 3. Sử dụng Component

### Cách dùng cơ bản

```tsx
<TrustProfileSection user={userData} reviews={reviewsData} />
```

### Cách dùng đầy đủ với tất cả props

```tsx
<TrustProfileSection
  user={userData}
  reviews={reviewsData}
  currentUserId="logged-in-user-id" // ID user đang đăng nhập
  previewCount={3} // Số review hiển thị ban đầu (default: 3)
  className="my-custom-class" // Custom CSS class
  onReviewUpdated={() => {
    // Callback khi review được cập nhật
    // Refresh data here
    refetchReviews();
  }}
/>
```

---

## 4. Props Reference

| Prop              | Type         | Required | Default | Mô tả                                                      |
| ----------------- | ------------ | -------- | ------- | ---------------------------------------------------------- |
| `user`            | `User`       | ✅       | -       | Thông tin user cần hiển thị profile                        |
| `reviews`         | `Review[]`   | ✅       | -       | Danh sách reviews của user                                 |
| `currentUserId`   | `string`     | ❌       | -       | ID user đang đăng nhập (để ưu tiên hiển thị review của họ) |
| `previewCount`    | `number`     | ❌       | `3`     | Số reviews hiển thị ban đầu                                |
| `className`       | `string`     | ❌       | `""`    | Custom CSS class cho container                             |
| `onReviewUpdated` | `() => void` | ❌       | -       | Callback gọi khi review được update                        |

---

## 5. Ví dụ Tích hợp Hoàn chỉnh

```tsx
import { useState, useEffect } from "react";
import { TrustProfileSection } from "@/features/trust-profile/sections/TrustProfileSection";
import type { User, Review } from "@/features/trust-profile/types";
import { getUserProfile, getUserReviews } from "@/api/userService";

export function UserProfilePage({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [userData, reviewsData] = await Promise.all([
        getUserProfile(userId),
        getUserReviews(userId),
      ]);
      setUser(userData);
      setReviews(reviewsData);
      setIsLoading(false);
    }
    fetchData();
  }, [userId]);

  // Refresh callback
  const handleReviewUpdated = () => {
    getUserReviews(userId).then(setReviews);
  };

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl mb-6">User Profile</h1>

      <TrustProfileSection
        user={user}
        reviews={reviews}
        currentUserId={loggedInUserId}
        onReviewUpdated={handleReviewUpdated}
      />
    </div>
  );
}
```

---

## 6. Features Tự động

Component tự động xử lý:

- ✅ **Layout responsive**: Grid 4/8 columns, stack trên mobile
- ✅ **Sticky Trust Card**: Card bên trái dính khi scroll
- ✅ **Tính toán stats**: Tự động tính average score, rating distribution
- ✅ **Sort reviews**: Review của current user lên đầu, còn lại theo thời gian
- ✅ **See all reviews**: Button mở full-page view khi có nhiều reviews
- ✅ **Edit review**: Cho phép user sửa review của chính họ (trong 72h)
