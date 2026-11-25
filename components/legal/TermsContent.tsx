"use client"

import Link from "next/link"
import {
  AlertTriangle,
  Ban,
  Copyright,
  CreditCard,
  FileCheck2,
  Gamepad2,
  Mail,
  Scale,
  ShieldAlert,
} from "lucide-react"
import { useLocale } from "@/lib/i18n/LanguageContext"
import { LegalPageLayout } from "./LegalPageLayout"

interface TermsContentProps {
  supportEmail?: string
}

/**
 * Concise, fair Terms of Service covering educator responsibilities, AI verification, quotas, and liability.
 */
export function TermsContent({ supportEmail }: TermsContentProps) {
  const { messages: t } = useLocale()
  const terms = t.termsPage
  const common = t.legalCommon

  const tocItems = [
    { id: "sec-1", label: terms.toc1 },
    { id: "sec-2", label: terms.toc2 },
    { id: "sec-3", label: terms.toc3 },
    { id: "sec-4", label: terms.toc4 },
    { id: "sec-5", label: terms.toc5 },
    { id: "sec-6", label: terms.toc6 },
    { id: "sec-7", label: terms.toc7 },
    { id: "sec-8", label: terms.toc8 },
  ]

  return (
    <LegalPageLayout
      activePage="terms"
      badge={terms.badge}
      title={terms.title}
      subtitle={terms.subtitle}
      tocItems={tocItems}
      supportEmail={supportEmail}
    >
      {/* 1. Acceptance & Eligibility */}
      <section id="sec-1" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s1Title}</span>
        </h2>
        <p>{terms.s1P1}</p>
      </section>

      {/* 2. Platform Use & Teacher Responsibility */}
      <section id="sec-2" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Gamepad2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s2Title}</span>
        </h2>
        <p>{terms.s2P1}</p>
        <p>{terms.s2P2}</p>
      </section>

      {/* 3. AI Disclosure & Content Review */}
      <section id="sec-3" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{terms.s3Title}</span>
        </h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-1.5">
          <h3 className="text-sm font-bold text-amber-950">{terms.s3BoxTitle}</h3>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">{terms.s3BoxDesc}</p>
        </div>
      </section>

      {/* 4. Acceptable Use */}
      <section id="sec-4" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Ban className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s4Title}</span>
        </h2>
        <p>{terms.s4Lead}</p>
        <ul className="list-disc list-inside space-y-2 ps-2 text-sm">
          <li>{terms.s4Item1}</li>
          <li>{terms.s4Item2}</li>
          <li>{terms.s4Item3}</li>
          <li>{terms.s4Item4}</li>
        </ul>
      </section>

      {/* 5. Plans, Quotas & Subscriptions */}
      <section id="sec-5" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s5Title}</span>
        </h2>
        <p>{terms.s5P1}</p>
        <p>{terms.s5P2}</p>
      </section>

      {/* 6. Intellectual Property */}
      <section id="sec-6" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Copyright className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s6Title}</span>
        </h2>
        <p>{terms.s6P1}</p>
      </section>

      {/* 7. Disclaimers & Liability */}
      <section id="sec-7" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <Scale className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s7Title}</span>
        </h2>
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 sm:p-5 space-y-2.5 text-xs sm:text-sm">
          <p>{terms.s7P1}</p>
          <p>{terms.s7P2}</p>
        </div>
      </section>

      {/* 8. Suspension, Updates & Contact */}
      <section id="sec-8" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{terms.s8Title}</span>
        </h2>
        <p>{terms.s8P1}</p>
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
