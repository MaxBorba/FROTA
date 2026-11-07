# Security Specification: Frota NRE Maringá (Cloud Firestore)

## 1. Data Invariants
1. **Permanent History Retention**: Trip records (`/trips/{tripId}`) cannot be deleted by standard users. Only authorized Admin (`maxborba71@gmail.com` or verified admin document) can delete records or clear history.
2. **Trip Identity & Integrity**: A trip record must have an `id`, `type` ('SAÍDA' | 'CHEGADA' | 'ABASTECIMENTO'), `vehicle`, `date`, `time`, `driver`, and numeric `timestamp`. Once created, core audit fields cannot be altered to conceal mileage or driver identity.
3. **Vehicle State & Odometer Monotonicity**: Vehicles (`/vehicles/{vehicleId}`) require valid IDs matching pattern `^[a-zA-Z0-9_\-]+$`, with status strictly restricted to `AVAILABLE`, `UNAVAILABLE`, or `MAINTENANCE`.
4. **Access Logs Immutability**: Access logs (`/accessLogs/{logId}`) are append-only audit records. No client can update or overwrite existing logs.
5. **No Spoofed Roles**: User profiles (`/users/{userId}`) can only be written by the authenticated user (`request.auth.uid == userId`), and users cannot grant themselves `role: 'admin'`. Only pre-authorized admin emails (`maxborba71@gmail.com`) can hold or assign admin rights.

## 2. The "Dirty Dozen" Payloads (Adversarial Test Vectors)

1. **Payload 1 (Ghost Field Injection)**: Creating a trip with rogue field `__proto__: "malicious"` or `isApproved: true`. Expected: `PERMISSION_DENIED`.
2. **Payload 2 (Unauthenticated Write)**: Anonymous / unauthenticated write to `/trips/trip_101`. Expected: `PERMISSION_DENIED`.
3. **Payload 3 (Unauthorized Deletion)**: Regular user attempting `DELETE /trips/trip_101`. Expected: `PERMISSION_DENIED`.
4. **Payload 4 (Privilege Escalation in Profile)**: User `user_abc` writes `{ uid: "user_abc", email: "user@nre.pr.gov.br", role: "admin" }` to `/users/user_abc`. Expected: `PERMISSION_DENIED`.
5. **Payload 5 (Cross-User Profile Tampering)**: User `user_1` attempts writing to `/users/user_2`. Expected: `PERMISSION_DENIED`.
6. **Payload 6 (Odometer Non-Numeric Poisoning)**: Write to `/vehicles/cobalt` with `{ odometer: "string-km-100" }`. Expected: `PERMISSION_DENIED`.
7. **Payload 7 (Invalid Vehicle Status)**: Updating vehicle status to `DESTROYED` or rogue enum value. Expected: `PERMISSION_DENIED`.
8. **Payload 8 (Log Record Tampering)**: Attempt to update or delete an existing `/accessLogs/acc_123` document. Expected: `PERMISSION_DENIED`.
9. **Payload 9 (Oversized Payload / Denial of Wallet)**: Injecting 2MB base64 junk into `visitReason` or `driver`. Expected: `PERMISSION_DENIED`.
10. **Payload 10 (Path ID Poisoning)**: Attempting document path with special injection characters `/vehicles/../../evil`. Expected: `PERMISSION_DENIED`.
11. **Payload 11 (Trip Immutability Bypass)**: Updating a completed trip's `km` or `driver` by an unauthorized non-admin client. Expected: `PERMISSION_DENIED`.
12. **Payload 12 (Blanket Collection Scraping)**: Attempt to read all private documents in default catch-all collection `/secret_config/keys`. Expected: `PERMISSION_DENIED`.
