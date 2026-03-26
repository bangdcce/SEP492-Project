import { ChevronRight } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "How does InterDev match brokers and freelancers?",
    answer:
      "Matching combines request requirements, profile trust signals, domain fit, and recent workflow context. AI suggestions refine ranking, but manual selection remains under client or broker control.",
  },
  {
    question: "When can a trust profile be viewed?",
    answer:
      "Trust profiles are available from discovery, invitation, and request flows where role-based visibility is allowed. They summarize reviews, trust score, and project history relevant to collaboration.",
  },
  {
    question: "What happens during a dispute?",
    answer:
      "Disputes move through intake, evidence review, hearing or mediation steps when needed, and a documented outcome. Appeal and escalation flows are tracked inside the same audit trail.",
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600">
          Help Center
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950">
          Frequently Asked Questions
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Core workflow, trust, and dispute questions that come up most often
          in InterDev.
        </p>
      </div>

      <div className="space-y-4">
        {FAQ_ITEMS.map((item) => (
          <section
            key={item.question}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <ChevronRight className="mt-1 h-5 w-5 text-teal-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {item.question}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">
                  {item.answer}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
