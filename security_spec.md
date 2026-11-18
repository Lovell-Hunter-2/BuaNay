# BữaNay Firestore Security Specification

## 1. Data Invariants
1. **Owner-Only Isolation & Admin Oversight**: Every user document and subcollection (`/users/{userId}`, `private`, `profile`, `meals`, `waterLogs`, `weightLogs`) is strictly isolated to `request.auth.uid == userId` with `request.auth.token.email_verified == true` and `!isKickedUser(userId)`, with verified staff (`isAdmin()` or `isModerator()`) read oversight. Only `isOwner(userId)` or `isAdmin()` can delete user data (moderators cannot kick or delete users).
2. **Tiered Staff RBAC (`admin` vs `moderator`)**:
   - `taikhoanphubg4@gmail.com` (verified) is bootstrapped `admin`.
   - `/admins/{adminKey}` is keyed by normalized lowercase verified email with `role in ['admin', 'moderator']`.
   - Only `isAdmin()` can appoint/update/kick staff in `/admins`, kick/restore users in `/kickedUsers`, update `/appConfig/runtime`, or approve/activate/delete dishes in `/catalogDishes`.
   - `isModerator()` can view dashboard stats and submit new `/catalogDishes` strictly locked to `status == 'pending' && isActive == false` (awaiting admin approval).
3. **PII Separation**: Email and provider metadata remain isolated in `/users/{userId}/private/account` (`get` by verified owner or staff only; no `list` allowed).
4. **Parent Anchor Gate**: Subcollection creates and updates verify the parent `/users/{userId}` document exists (`exists(...)`) and has matching `uid == request.auth.uid`.
5. **Immutable Ownership & Creation Timestamps**: `uid`, `id`, and `createdAt` cannot be modified on `update`; `createdAt == request.time` on `create`; `updatedAt == request.time` on both `create` and `update`.
6. **Immutable Audit Trail**: `/adminLogs/{logId}` allows verified staff `create`, `get`, `list` only; `update` and `delete` are permanently denied (`if false`).
7. **Bounded Arrays & Strings**: Every string checks `.size()` bounds; every array enforces `.size() <= MAX` and checks element type on index `0` when non-empty.
8. **Zero Unauthenticated / Cross-Tenant List Access**: Public reads on `/catalogDishes` require `isActive == true && status == 'approved'`.

## 2. Adversarial "Dirty Dozen" Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Unauthenticated read/write**: Read `/users/u1/profile/nutrition` with `request.auth == null`.
2. **Unverified email admin spoof**: Access `/users` or `/adminLogs` with admin email when `request.auth.token.email_verified == false`.
3. **Cross-user read**: Read `/users/u2/private/account` while signed in as non-staff `u1`.
4. **Moderator privilege escalation**: Moderator tries to create or update `/admins/mod@buanay.app` with `role: 'admin'`.
5. **Moderator self-approval of pending dish**: Moderator creates `/catalogDishes/dish_1` with `status: 'approved'` or `isActive: true`.
6. **Moderator kicking a user**: Moderator tries to write `/kickedUsers/u2` or delete `/users/u2`.
7. **Moderator changing system config**: Moderator tries to update `/appConfig/runtime`.
8. **Kicked user sync bypass**: User listed in `/kickedUsers/u1` tries to create/update `/users/u1/meals/m1`.
9. **Audit log tampering**: Even an admin tries to `update` or `delete` an existing `/adminLogs/log_1` document.
10. **ID poisoning**: Write `/catalogDishes/${"a".repeat(200)}` or path ID containing `$` / `.` characters.
11. **Client-spoofed timestamp**: Create `/catalogDishes/dish_1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
12. **Type / Range poisoning**: Create `/catalogDishes/dish_1` with `calories: -50` or `slots: ["Sáng", "Trưa", "Xế", "Tối", "Đêm"]`.
