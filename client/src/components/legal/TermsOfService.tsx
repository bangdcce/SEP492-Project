const LAST_UPDATED = "March 22, 2026";

const SECTION_TITLE =
  "mb-3 text-2xl font-semibold tracking-tight text-slate-950";
const PARAGRAPH = "text-sm leading-7 text-slate-600 sm:text-base";
const LIST = "ml-5 list-disc space-y-2 text-sm leading-7 text-slate-600 sm:text-base";

export default function TermsOfService() {
  return (
    <div className="space-y-10">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-600">
          Last updated
        </p>
        <p className="mt-2 text-base text-slate-600">{LAST_UPDATED}</p>
      </div>

      <section>
        <h2 className={SECTION_TITLE}>1. Platform Scope</h2>
        <p className={PARAGRAPH}>
          InterDev is a workflow platform for clients, brokers, freelancers,
          staff, and admins. The platform covers account creation, trust
          signals, request intake, specification review, project coordination,
          and dispute operations. Using the platform means you agree to these
          terms and to the connected privacy rules published with them.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>2. Eligibility and Account Use</h2>
        <ul className={LIST}>
          <li>You must provide accurate registration details.</li>
          <li>You are responsible for securing your login credentials.</li>
          <li>
            You must not share access, impersonate another user, or submit
            misleading professional or trust information.
          </li>
          <li>
            The platform may restrict or suspend access when account activity
            conflicts with trust, moderation, or legal requirements.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>3. Verification and Trust Signals</h2>
        <p className={PARAGRAPH}>
          InterDev uses identity verification, trust scores, reviews, and
          project history to support safer decision-making. These signals are
          part of platform governance, not a guarantee of outcome. Access to
          some trust profile data depends on role relationships and active
          workflow context.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>4. Request, Spec, and Project Workflow</h2>
        <p className={PARAGRAPH}>
          Clients may start with guided intake. Brokers may then formalize the
          request into a stronger project spec. Freelancers may join through
          invitations or proposals depending on the current state. A request
          does not become an active delivery project until the relevant review
          and contract steps are completed.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>5. Content and Conduct Rules</h2>
        <ul className={LIST}>
          <li>Do not upload unlawful, abusive, deceptive, or stolen content.</li>
          <li>
            Do not manipulate reviews, trust signals, or workflow records.
          </li>
          <li>
            Do not misuse dispute channels, hearing spaces, or external meeting
            links.
          </li>
          <li>
            Do not attempt to bypass platform controls that protect audit,
            moderation, or privacy-sensitive flows.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>6. Disputes and Hearings</h2>
        <p className={PARAGRAPH}>
          When a dispute is raised, the platform may collect evidence, record
          communication, and schedule hearing-related actions. External meeting
          links, hearing records, and internal moderation controls are part of
          the operational dispute process. Parties must act honestly and in
          good faith throughout that process.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>7. Suspension and Enforcement</h2>
        <p className={PARAGRAPH}>
          InterDev may suspend, limit, or terminate access where required for
          safety, legal compliance, fraud prevention, moderation, or platform
          integrity. Internal staff and admins may use audit and moderation
          tools to review system activity when necessary.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>8. Intellectual Property</h2>
        <p className={PARAGRAPH}>
          Platform branding, interface assets, and system workflows remain the
          property of InterDev or its licensors. You retain ownership of the
          content you upload, but grant the platform the limited rights needed
          to store, display, review, and process that content within the
          service.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>9. Liability and Service Boundaries</h2>
        <p className={PARAGRAPH}>
          InterDev provides workflow infrastructure and trust tooling. The
          platform does not guarantee project success, uninterrupted service, or
          a specific commercial outcome between parties. Each user remains
          responsible for the decisions they make inside the workflow.
        </p>
      </section>

      <section>
        <h2 className={SECTION_TITLE}>10. Contact</h2>
        <p className={PARAGRAPH}>
          Questions about these terms can be sent to{" "}
          <a
            href="mailto:legal@interdev.vn"
            className="font-medium text-teal-700 hover:text-teal-800"
          >
            legal@interdev.vn
          </a>
          .
        </p>
      </section>
    </div>
  );
}
