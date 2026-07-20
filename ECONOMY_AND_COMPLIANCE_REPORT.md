# ECONOMY & COMPLIANCE REPORT — ARVIND PARTY Backend

## PART A — Dual Currency Economy

### Currency Flow
```
User buys coins → Google Play → /api/economy/verify-google-play → coins credited (+ bonus diamonds)
User sends gift → sender.coins -= cost → receiver.diamonds += giftValue * (1 - commission)
Staff withdrawal → deduct diamonds → external payout (manual)
```

### Models Created
| Model | Purpose |
|-------|---------|
| `DiamondWithdrawalRequest` | Tracks staff withdrawal requests with payoutRatio snapshot |
| `AccountDeletionRequest` | 30-day grace period deletion with cancel support |

### Models Modified
| Model | Changes |
|-------|---------|
| `RechargePlan` | Added `diamondsAwarded` (Number), `googlePlayProductId` (String) |
| `SystemSettings` | Added `diamond_to_payout_ratio`, `payout_currency_label`, withdrawal limits |
| `Staff` | Added 3 new roles: `official`, `super_coin_seller`, `normal_coin_seller` |

### New Endpoints

#### Economy (`/api/economy`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/verify-google-play` | Google Play receipt verification + coin+diamond credit |
| GET | `/balance` | Current user wallet balance (coins + diamonds) |

#### Diamond Withdrawals (`/api/admin/diamond-withdrawals`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/request` | Staff | Request diamond withdrawal |
| GET | `/my-requests` | Staff | View own requests |
| GET | `/all` | Staff | View all requests (admin) |
| PUT | `/:id/approve` | Staff | Approve request |
| PUT | `/:id/mark-paid` | Staff | Mark as paid (after external transfer) |
| PUT | `/:id/reject` | Staff | Reject + refund diamonds |
| PUT | `/:id/clear-notification` | Staff | Clear notification flag |

#### Gift Flow (modified)
- Sender pays: `sender.coins -= totalCost`
- Receiver earns: `receiver.diamonds += finalReceiverDiamonds`
- Agency commission deducted from diamonds (10%)

---

## PART B — International-Readiness

### Content Moderation
| Model | Fields |
|-------|--------|
| `ContentReport` | 8 report reasons, 4 content types, moderation workflow |

#### Moderation Endpoints (`/api/moderation`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/report` | User | Submit content report |
| GET | `/reports` | Staff | List reports with filters |
| PUT | `/resolve/:id` | Staff | Resolve report with action taken |
| PUT | `/dismiss/:id` | Staff | Dismiss report |

Actions: `NONE`, `WARNING`, `CONTENT_REMOVED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_BANNED`

### Legal Compliance
| Model | Purpose |
|-------|---------|
| `LegalDocument` | Privacy Policy, Terms of Service, Community Guidelines |
| `AccountDeletionRequest` | Google Play mandatory 30-day grace period |

#### Legal Endpoints (`/api/legal`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/document/:type` | Get document by type |
| GET | `/documents` | List all documents |
| POST | `/document` | Create/update document (Staff) |
| POST | `/accept` | Record user acceptance |
| POST | `/request-deletion` | Request account deletion (30-day) |
| POST | `/cancel-deletion` | Cancel pending deletion |

### Fraud Detection Enhancements
| Check | Threshold | Action |
|-------|-----------|--------|
| IP referral farming | >5 accounts/24h from same IP | Fraud alert |
| Device fingerprint farming | >3 accounts/24h from same device | Fraud alert |

### Support System (already existed)
Full ticket system at `/api/support` with:
- Create ticket, reply, status updates
- FAQ system, visitor history, privacy controls
- Follow/unfollow, block/unblock, profile management

---

## Commission Structure
```
Gift sent → 30% commission (GlobalSetting.giftCommission)
         → 10% agency commission from remaining
         → Receiver gets 63% of gift value as diamonds

Example: 100 coin gift
  → 30 coins commission
  → 70 remaining
  → 7 coins agency (10%)
  → 63 diamonds credited to receiver
```

## Staff Role Eligibility for Withdrawals
Owner, Super Admin, Admin, Finance Manager, Official

---

*Implemented: July 2026 | Git Commit: a3e1a1e*
