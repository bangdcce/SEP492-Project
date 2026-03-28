const LAST_UPDATED = "March 22, 2026";

const SECTION_TITLE =
  "mb-3 text-2xl font-semibold tracking-tight text-slate-950";
const PARAGRAPH = "text-sm leading-7 text-slate-600 sm:text-base";
const LIST = "ml-5 list-disc space-y-2 text-sm leading-7 text-slate-600 sm:text-base";

export default function PrivacyPolicy() {
  return (
    <div className="space-y-10">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-600">
          Last updated
        </p>
        <p className="mt-2 text-base text-slate-600">{LAST_UPDATED}</p>
      </div>

      <section>
        <h2 className={SECTION_TITLE}>1. What this policy covers</h2>
        <p className={PARAGRAPH}>
          This policy describes how InterDev handles personal and operational
          data across authentication, trust signals, request workflows, dispute
          operations, and protected verification flows.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>2. Information we collect</h2>
        <ul className={LIST}>
          <li>Account identity data such as name, email, role, and phone.</li>
          <li>
            Verification data related to KYC and account trust workflows.
          </li>
          <li>
            Activity data such as login, audit, moderation, and workflow
            history.
          </li>
          <li>
            Request, contract, project, review, and dispute records created
            while using the platform.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>3. Why we use this data</h2>
        <ul className={LIST}>
          <li>To authenticate users and protect account access.</li>
          <li>
            To support trust profile features, moderation, and review safety.
          </li>
          <li>
            To operate request, contract, project, and dispute workflows.
          </li>
          <li>
            To investigate abuse, security incidents, or policy violations.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>4. Sensitive and verification data</h2>
        <p className={PARAGRAPH}>
          Identity and verification data are treated as sensitive. Access is
          restricted to authorized internal roles and is tied to security,
          verification, and governance requirements. KYC and related review
          flows are not exposed as general public profile data.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>5. Operational records</h2>
        <p className={PARAGRAPH}>
          InterDev may keep audit records, moderation actions, dispute activity,
          and hearing-related workflow data to support system integrity,
          incident review, and role-based oversight.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>6. Sharing and access control</h2>
        <p className={PARAGRAPH}>
          Data is shared according to workflow role and need-to-know rules.
          Trust profile visibility, client context, and dispute visibility are
          intentionally scoped so unrelated users do not get unrestricted
          access to sensitive records.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>7. Retention and protection</h2>
        <p className={PARAGRAPH}>
          InterDev uses role-based controls, protected storage patterns, and
          workflow-aware restrictions to reduce unnecessary access to personal
          and operational data. Retention may differ across account, trust,
          legal, and dispute records.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>8. Your choices</h2>
        <ul className={LIST}>
          <li>You can review public-facing legal information before signing up.</li>
          <li>
            You may contact the privacy channel with questions about protected
            data handling.
          </li>
          <li>
            Some data cannot be removed immediately when it is required for
            fraud prevention, auditability, or dispute/legal workflows.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>9. Contact</h2>
        <p className={PARAGRAPH}>
          Questions about privacy or protected data handling can be sent to{" "}
          <a
            href="mailto:privacy@interdev.vn"
            className="font-medium text-teal-700 hover:text-teal-800"
          >
            privacy@interdev.vn
          </a>
          .
        </p>
      </section>
    </div>
  );
}
