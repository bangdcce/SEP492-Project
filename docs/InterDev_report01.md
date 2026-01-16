# Capstone Project Report: InterDev
## 1. Project Introduction

### 1.1 Overview
* **Project Name:** InterDev - Freelance Software Project Brokerage Platform for SMEs in Vietnam.
* **Project Code:** InterDev
* **Group:** SEP490_06 (FPT University)
* **Type:** Web Application

### 1.2 Team Members
* **Supervisor:** Luong Hoang Huong
* **Members:** Ngo Thai Son (Leader), Dang Chi Bang, Nguyen Phuc An, Nguyen Gia Bao, Pham Tri Trong An.

### 1.3 Product Background
* **Problem:** SMEs in Vietnam need digitalization but lack technical knowledge to write specs, fearing scams. Freelancers face vague requirements. Current platforms (vLance, Freelancer) lack a quality control layer ("Broker").
* **Solution:** A platform with a "Broker" (BA/PM) intermediary to standardize requirements, verify technical quality, and simulate Escrow.

---

## 2. Technology Stack & Architecture

### 2.1 Frontend: React
* **Features:** Component-Based, Virtual DOM, One-way Data Binding.
* **Why:** High performance, reusability, rich ecosystem.

### 2.2 Backend: NestJS
* **Features:** Modular Architecture, TypeScript, Dependency Injection.
* **Architecture:** Layered Architecture (Controller -> Service -> Repository -> Data).

### 2.3 Database: PostgreSQL
* **Why:** ACID Compliance, Reliability, Complex Query Support.

### 2.4 Supporting Tools
* **Docker:** Containerization for consistency.
* **Firebase Cloud Storage:** Storing user-generated content (files, images).
* **Redis:** In-memory caching for performance.
* **GitHub Actions:** CI/CD automation.
* **Tailwind CSS:** Utility-first CSS framework.
* **Google reCAPTCHA:** Security/Bot detection.

### 2.5 Architecture Pattern
* **System:** Client-Server Architecture.
* **Backend:** Layered Architecture (Presentation, Application, Domain, Persistence).
* **Frontend:** Component-Based Architecture.

---

## 3. Existing Systems Analysis

### 3.1 vLance (Vietnam)
* **Pros:** Local language/payments.
* **Cons:** Lack of "Broker" to verify specs, "low-balling" bids, lack of business support mechanism.

### 3.2 Freelancer.com (Global)
* **Pros:** Massive talent pool.
* **Cons:** Language/Cultural barriers, Payment friction for VN SMEs, disconnect from local business norms.

### 3.3 Fiverr (Global)
* **Pros:** Simple "Service as a Product".
* **Cons:** Too inflexible for custom SME needs, transactional nature conflicts with VN relationship-based culture.

---

## 4. Business Opportunity
* **Target:** SMEs/Shop owners with budget (10-50M VND) but no tech skills.
* **Value Proposition (Managed Freelance Model):**
    1.  **Bridging Knowledge Gap:** Guided Input Wizard + Broker translation.
    2.  **Building Trust:** Virtual Escrow + Broker validation.
    3.  **Standardization:** Structured workflow (Spec -> Contract -> Milestone).

---

## 5. Software Product Vision
* **Roles:** Guest, Client (SME), Freelancer, Broker, Administrator.
* **Core Concept:** A unified environment where software outsourcing is simplified via a dedicated Broker layer ensuring transparency, trust, and quality delivery.

---

## 6. Project Scope & Limitations

### 6.1 Major Features (FE)
* **FE-01 Auth:** Login/Register, RBAC.
* **FE-02 KYC:** Upload ID/Face, Admin approval.
* **FE-03 Broker App:** User applies with CV, Admin vets.
* **FE-04 Wizard:** Guided input for Clients (Web/App, Budget, Features).
* **FE-05 Spec:** Broker converts request to Spec & Milestones.
* **FE-06 Matching:** Filter by Skill, Trust Score.
* **FE-07 E-Contract:** Digital sign + Virtual Escrow lock.
* **FE-08 Workspace:** Dashboard for Team (Client, Broker, Freelancer).
* **FE-09 Task Mgmt:** Kanban Board.
* **FE-10 Chat:** Real-time messaging with attachments.
* **FE-11 Submission:** Freelancer submits Proof of Work (Demo/Code).
* **FE-12 Acceptance:** Broker Review -> Staff/Client Review -> Release Money.
* **FE-13 Change Request:** Manage scope changes.
* **FE-14 Wallet:** Transaction history, withdrawals.
* **FE-15 Fees:** Split payment (Freelancer/Broker/Platform).
* **FE-16 Rating:** Trust Score calculation.
* **FE-17 Dispute:** Admin resolution dashboard.
* **FE-18 Notifications:** In-app alerts.
* **FE-19/20 Dashboards:** User Portfolio & Admin Stats.

### 6.2 Limitations (LI)
* **LI-01:** Simplified Contracts (Templates).
* **LI-02:** Basic messaging (No video/voice/advanced websocket features).
* **LI-03:** No Email/SMS notifications.
* **LI-04:** Single server instance (No Load Balancing/HA).
* **LI-05:** Basic Admin Dashboard (No advanced analytics).
* **LI-06:** Web only (No mobile app).
* **LI-07:** Basic security (No 2FA, Penetration testing).
* **LI-08:** Simple matching filters (No AI/ML).
* **LI-09:** Not multi-tenant/Enterprise scale.