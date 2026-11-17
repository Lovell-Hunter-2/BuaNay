# BữaNay Firestore Security Specification

## 1. Data Invariants
1. **Owner-Only Isolation**: Every user document and subcollection (`/users/{userId}`, `private`, `profile`, `meals`, `waterLogs`, `weightLogs`) is strictly isolated to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **PII Separation**: Email and provider metadata are stored exclusively in `/users/{userId}/private/account` (`get`, `create`, `update` by verified owner only; no `list` allowed).
3. **Parent Anchor Gate**: Subcollection creates and updates verify the parent `/users/{userId}` document exists (`exists(...)`) and has matching `uid == request.auth.uid`.
4. **Immutable Ownership & Creation Timestamps**: `uid` and `createdAt` cannot be modified on `update`; `createdAt == request.time` on `create`; `updatedAt == request.time` on both `create` and `update`.
5. **Bounded Arrays & Strings**: Every string checks `.size()` bounds; every array (`dietaryTags`, `kitchenTools`, `healthConditions`, `contexts`, `likedDishes`, `dislikedDishes`, `triedDishes`) enforces `.size() <= MAX` and checks element type on index `0` when non-empty.
6. **Zero Unauthenticated / Cross-Tenant List Access**: `allow list` on `meals`, `waterLogs`, and `weightLogs` explicitly requires `isVerifiedOwner(userId) && existing().uid == request.auth.uid` without calling `get()`/`exists()` inside `list`.

## 2. Adversarial "Dirty Dozen" Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Unauthenticated read/write**: Read `/users/u1/profile/nutrition` with `request.auth == null`.
2. **Unverified email write**: Create `/users/u1/meals/meal_1` when `request.auth.token.email_verified == false`.
3. **Cross-user read**: Read `/users/u2/private/account` while signed in as `u1`.
4. **Cross-user list**: List `/users/u2/meals` while signed in as `u1`.
5. **Identity spoofing**: Create `/users/u1/meals/meal_1` with `{ uid: "u2", ... }` while signed in as `u1`.
6. **Shadow / Ghost field injection**: Create `/users/u1` with `{ uid: "u1", displayName: "An", isAdmin: true, ... }`.
7. **ID poisoning**: Write `/users/u1/meals/${"a".repeat(200)}` or path ID containing `$` / `.` characters.
8. **Invalid dateKey poisoning**: Create `/users/u1/waterLogs/not-a-date` with invalid `dateKey`.
9. **Client-spoofed timestamp**: Create `/users/u1/meals/meal_1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
10. **Immutable field mutation**: Update `/users/u1/meals/meal_1` changing `createdAt` or `uid`.
11. **Type / Range poisoning**: Update `/users/u1/profile/nutrition` setting `age: 5`, `targetCalories: -100`, or `name: "x".repeat(200)`.
12. **Unbounded array flooding**: Update `/users/u1/profile/nutrition` setting `dietaryTags` to 50 items or `[123]`.
