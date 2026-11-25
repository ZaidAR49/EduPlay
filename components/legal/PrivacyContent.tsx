"use client"

import Link from "next/link"
import {
  Bot,
  Clock,
  Cookie,
  Database,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react"
import { useLocale } from "@/lib/i18n/LanguageContext"
import { LegalPageLayout } from "./LegalPageLayout"

interface PrivacyContentProps {
  supportEmail?: string
}

/**
 * Concise, transparent Privacy Policy detailing student anonymity, AI usage, third-party services, and 30-day retention.
 */
export function PrivacyContent({ supportEmail }: PrivacyContentProps) {
  const { messages: t } = useLocale()
  const p = t.privacyPage
  const common = t.legalCommon

  const tocItems = [
    { id: "sec-1", label: p.toc1 },
    { id: "sec-2", label: p.toc2 },
    { id: "sec-3", label: p.toc3 },
    { id: "sec-4", label: p.toc4 },
    { id: "sec-5", label: p.toc5 },
    { id: "sec-6", label: p.toc6 },
  ]

  const thirdPartyServices = [
    { title: p.s3Item1Title, badge: p.s3Item1Badge, desc: p.s3Item1Desc },
    { title: p.s3Item2Title, badge: p.s3Item2Badge, desc: p.s3Item2Desc },
    { title: p.s3Item3Title, badge: p.s3Item3Badge, desc: p.s3Item3Desc },
    { title: p.s3Item4Title, badge: p.s3Item4Badge, desc: p.s3Item4Desc },
    { title: p.s3Item5Title, badge: p.s3Item5Badge, desc: p.s3Item5Desc },
  ]

  return (
    <LegalPageLayout
      activePage="privacy"
      badge={p.badge}
      title={p.title}
      subtitle={p.subtitle}
      tocItems={tocItems}
      supportEmail={supportEmail}
    >
      {/* 1. Overview & Student Privacy */}
      <section id="sec-1" className="scroll-mt-28 space-y-4">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{p.s1Title}</span>
        </h2>
        <p>{p.s1Intro}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900">{p.s1StudentTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">{p.s1StudentDesc}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900">{p.s1TeacherTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">{p.s1TeacherDesc}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 space-y-1.5">
            <h3 className="text-sm font-bold text-gray-900">{p.s1UsageTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">{p.s1UsageDesc}</p>
          </div>
        </div>
      </section>

      {/* 2. How We Use AI */}
      <section id="sec-2" className="scroll-mt-28 space-y-4">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Bot className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{p.s2Title}</span>
        </h2>
        <p>{p.s2Intro}</p>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{p.s2BoxTitle}</span>
          </div>
          <p className="text-xs sm:text-sm text-emerald-950/90 leading-relaxed">
            {p.s2BoxDesc}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-gray-600">{p.s2ByoNote}</p>
      </section>

      {/* 3. Third-Party Services */}
      <section id="sec-3" className="scroll-mt-28 space-y-4">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Database className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{p.s3Title}</span>
        </h2>
        <p>{p.s3Intro}</p>

        <div className="space-y-3">
          {thirdPartyServices.map((service) => (
            <div
              key={service.title}
              className="rounded-2xl border border-gray-200/80 bg-gray-50/50 p-4 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">{service.title}</h3>
                <span className="rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                  {service.badge}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Cookies & Local Storage */}
      <section id="sec-4" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Cookie className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{p.s4Title}</span>
        </h2>
        <p>{p.s4P1}</p>
        <p>{p.s4P2}</p>
      </section>

      {/* 5. Data Retention & Deletion */}
      <section id="sec-5" className="scroll-mt-28 space-y-4">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{p.s5Title}</span>
        </h2>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-1.5">
          <h3 className="text-sm font-bold text-amber-950">{p.s5BoxTitle}</h3>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">{p.s5BoxDesc}</p>
        </div>

        <p>{p.s5P1}</p>
      </section>

      {/* 6. Your Rights & Contact */}
      <section id="sec-6" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{p.s6Title}</span>
        </h2>
        <p>{p.s6P1}</p>
        <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
          <Link
            href="/contact"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span>{common.contactSupport}</span>
          </Link>
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="font-mono text-xs sm:text-sm text-gray-700 hover:text-emerald-600 underline"
              dir="ltr"
            >
              {supportEmail}
            </a>
          )}
        </div>
      </section>
    </LegalPageLayout>
  )
}
