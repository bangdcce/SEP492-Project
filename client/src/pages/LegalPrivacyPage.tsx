import PrivacyPolicy from "@/components/legal/PrivacyPolicy";

export default function LegalPrivacyPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600">
          Legal
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          Privacy Policy
        </h1>
      </div>
      <PrivacyPolicy />
    </div>
  );
}
