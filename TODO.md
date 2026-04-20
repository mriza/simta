# SIMTA Project TODO & Audit Findings

This document tracks identified bugs, inconsistencies, and potential improvements identified during the comprehensive audit on 2026-04-20.

## 🔴 Critical & Bugs
- [ ] **Race Condition in `permitSidang`**: Simultaneous approvals by both supervisors may fail to trigger the final `ijinkan_sidang` permission because each request reads the student's state before the other's update.
- [ ] **Missing Backend PDF Validation**: `uploadFinal` accepts any file. Needs MIME-type and size validation (e.g., max 5MB).
- [ ] **Hardcoded JWT Secret**: `JWT_SECRET` should be moved to an environment variable or secret manager rather than having a default value in the binary.

## 🟡 Inconsistencies & UX
- [ ] **Public Verification UI**: Currently only shows "Diizinkan Sidang" status. It should show individual supervisor approval names/dates for academic transparency.
- [ ] **Dashboard Refresh**: The dashboard doesn't always reflect immediate changes without a manual refresh or tab switch. Consider a periodic poll or WebSocket.
- [ ] **Responsive Tables**: Some tables in the `Mahasiswa` tab overflow on mobile viewports.

## 🔵 Future Improvements & Technical Debt
- [x] **Complete Test Coverage to 100%**: Fix failing frontend tests and ensure all tests pass.
- [x] **Add Integration Tests**: Create tests for API endpoints with database interactions.
- [x] **Add End-to-End Tests with Puppeteer**: Set up Puppeteer for full browser testing of user workflows.
- [ ] **Database Indexing**: Add indexes to `mahasiswa(pembimbing1_id)`, `mahasiswa(pembimbing2_id)`, and `bimbingan(mhs_id)` to maintain performance as data grows.
- [ ] **Audit Trail**: Add a `log_audit` table to track administrative changes (who authorized who and when).
- [ ] **Email Notifications**: Notify students when a supervisor approves their sidang.
- [ ] **Clean App State**: `App.tsx` is becoming quite large (300+ lines). Consider splitting logic into custom hooks (e.g., `useAuth`, `useDataFetcher`).

## 🟢 Production Readiness & Security
- [ ] **Nginx/Cloudflare Setup**: Ensure Cloudflare Tunnels (or external Nginx) map `simta.cerdas.club` directly to port **3535** and `api-simta.cerdas.club` directly to port **3536**. DO NOT use intermediate ports (like 8035/8036) as it breaks the current domain mapping.
- [ ] **Database Backup Strategy**: Implement a cron job to run `pg_dump` on the `simta-postgres` container periodically to prevent data loss.
- [ ] **Environment Security**: Rotate `JWT_SECRET` and `ADMIN_PASSWORD` in the production `.env` before public launch.

---
*Created by Antigravity AI Audit - Final Production Check*
