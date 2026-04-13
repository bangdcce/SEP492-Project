import { Link } from "react-router-dom";
import { ROUTES } from "@/constants";
import {
  ArrowUpRight,
  Clock3,
  Github,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Youtube,
} from "lucide-react";

interface SiteFooterProps {
  tone?: "light" | "dark";
  className?: string;
}

const quickLinks = [
  { label: "Home", to: ROUTES.LANDING },
  { label: "FAQ", to: ROUTES.FAQ },
  { label: "Terms", to: ROUTES.LEGAL_TERMS },
  { label: "Privacy", to: ROUTES.LEGAL_PRIVACY },
];

const accessLinks = [
  { label: "Sign In", to: ROUTES.LOGIN },
  { label: "Create Account", to: ROUTES.REGISTER },
];

const contactItems = [
  {
    icon: Phone,
    label: "Hotline",
    value: "+84 28 7300 8899",
    href: "tel:+842873008899",
  },
  {
    icon: Mail,
    label: "General Support",
    value: "bao20048888@gmail.com",
    href: "mailto:bao20048888@gmail.com",
  },
  {
    icon: Mail,
    label: "Contracts Desk",
    value: "bao20048888@gmail.com",
    href: "mailto:bao20048888@gmail.com",
  },
  {
    icon: MapPin,
    label: "Office",
    value: "Ho Chi Minh City, Vietnam",
    href: "https://maps.google.com/?q=Ho%20Chi%20Minh%20City%2C%20Vietnam",
  },
];

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/interdev",
    icon: Linkedin,
  },
  {
    label: "GitHub",
    href: "https://github.com/interdev",
    icon: Github,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/interdev",
    icon: Instagram,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@interdev",
    icon: Youtube,
  },
];

export function SiteFooter({
  tone = "light",
  className = "",
}: SiteFooterProps) {
  const isDark = tone === "dark";
  const shellClass = isDark
    ? "border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98),rgba(6,78,59,0.82))] text-slate-100 shadow-[0_28px_80px_-56px_rgba(2,6,23,0.95)]"
    : "border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,253,250,0.98),rgba(248,250,252,0.98))] text-slate-700 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.35)]";
  const brandBadgeClass = isDark
    ? "border border-white/15 bg-white/10 text-teal-100"
    : "border border-teal-200 bg-teal-50 text-teal-700";
  const subtleTextClass = isDark ? "text-slate-300" : "text-slate-600";
  const sectionTitleClass = isDark ? "text-slate-100" : "text-slate-900";
  const linkClass = isDark
    ? "text-slate-300 hover:text-white"
    : "text-slate-600 hover:text-slate-950";
  const cardClass = isDark
    ? "border border-white/10 bg-white/5"
    : "border border-slate-200 bg-white/80";
  const socialButtonClass = isDark
    ? "border-white/10 bg-white/5 text-slate-200 hover:border-teal-300/40 hover:bg-white/10 hover:text-white"
    : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700";

  return (
    <footer
      className={`relative overflow-hidden rounded-[28px] border ${shellClass} ${className}`.trim()}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent" />
      <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-teal-400/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr_0.9fr_1.05fr]">
          <section className="space-y-5">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${brandBadgeClass}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              InterDev Network
            </span>

            <div className="space-y-3">
              <h2 className={`max-w-sm text-2xl font-semibold tracking-tight ${sectionTitleClass}`}>
                Clearer handoffs for client requests, broker orchestration, and freelancer delivery.
              </h2>
              <p className={`max-w-xl text-sm leading-7 ${subtleTextClass}`}>
                InterDev keeps request intake, trust signals, contracts, and dispute records in one
                workflow so teams can move faster without losing auditability.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${cardClass}`}>
                Trust Profiles
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${cardClass}`}>
                Contract Handoffs
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${cardClass}`}>
                Dispute-ready Logs
              </span>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-[0.18em] ${sectionTitleClass}`}>
              Quick Links
            </h3>
            <nav className="space-y-3 text-sm">
              {quickLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center justify-between transition-colors ${linkClass}`}
                >
                  <span>{item.label}</span>
                  <ArrowUpRight className="h-4 w-4 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              ))}
            </nav>
          </section>

          <section className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-[0.18em] ${sectionTitleClass}`}>
              Access
            </h3>
            <nav className="space-y-3 text-sm">
              {accessLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center justify-between transition-colors ${linkClass}`}
                >
                  <span>{item.label}</span>
                  <ArrowUpRight className="h-4 w-4 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              ))}
            </nav>

            <div className={`rounded-2xl p-4 ${cardClass}`}>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-teal-500" />
                <div>
                  <p className={`text-sm font-medium ${sectionTitleClass}`}>Support Window</p>
                  <p className={`mt-1 text-xs leading-6 ${subtleTextClass}`}>
                    Mon - Sat, 08:00 - 18:00 ICT for onboarding, contract, and dispute operations.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className={`text-sm font-semibold uppercase tracking-[0.18em] ${sectionTitleClass}`}>
              Contact
            </h3>

            <div className="space-y-3">
              {contactItems.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                    className={`flex items-start gap-3 rounded-2xl p-3 transition-colors ${cardClass} ${linkClass}`}
                  >
                    <span className={`rounded-xl p-2 ${isDark ? "bg-white/10" : "bg-slate-100"}`}>
                      <Icon className="h-4 w-4 text-teal-500" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>
                        {item.label}
                      </span>
                      <span className={`mt-1 block break-words text-sm font-medium ${sectionTitleClass}`}>
                        {item.value}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
          <div className={`text-sm ${subtleTextClass}`}>
            © {new Date().getFullYear()} InterDev. Workflow infrastructure for service delivery teams.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {socialLinks.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all ${socialButtonClass}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
