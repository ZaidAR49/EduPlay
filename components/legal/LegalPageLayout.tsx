"use client"

import Link from "next/link"
import { ArrowLeft, ChevronRight, FileText, Mail, Printer, ShieldCheck } from "lucide-react"
import { useLocale } from "@/lib/i18n/LanguageContext"

export interface LegalTocItem {
  id: string
  label: string
}

interface LegalPageLayoutProps {
  activePage: "privacy" | "terms"
  badge: string
  title: string
  subtitle: string
  tocItems: LegalTocItem[]
  supportEmail?: string
  children: React.ReactNode
}

/**
 * Shared bilingual RTL/LTR layout for EduPlay legal documentation pages (/privacy and /terms).
 */
export function LegalPageLayout({
  activePage,
  badge,
  title,
  subtitle,
  tocItems,
  supportEmail,
  children,
}: LegalPageLayoutProps) {
  const { messages: t } = useLocale()
  const common = t.legalCommon

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  return (
    <div className="flex-1 pt-24 pb-16 sm:pt-28 sm:pb-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Top Action Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 pb-5 print:hidden">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-white hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{common.backToHome}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {/* Switch between Privacy & Terms */}
            <nav
              aria-label="Legal navigation"
              className="inline-flex items-center rounded-xl bg-white p-1 border border-gray-200/80 shadow-xs"
            >
              <Link
                href="/privacy"
                className={`inline-flex min-h-[36px] items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  activePage === "privacy"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-emerald-600"
                }`}
              >
                {common.switchPrivacy}
              </Link>
              <Link
                href="/terms"
                className={`inline-flex min-h-[36px] items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  activePage === "terms"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-emerald-600"
                }`}
              >
                {common.switchTerms}
              </Link>
            </nav>

            <button
              type="button"
              onClick={handlePrint}
              aria-label={common.print}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{common.print}</span>
            </button>
          </div>
        </div>

        {/* Page Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3.5 py-1 text-xs font-bold text-emerald-700 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{badge}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-3">
            {title}
          </h1>

          <p className="max-w-3xl text-base text-gray-600 leading-relaxed mb-5">
            {subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-500">
            <span className="rounded-lg bg-white border border-gray-200/80 px-3 py-1.5">
              {common.effectiveDateLabel} {common.lastUpdatedDate}
            </span>
            <span className="rounded-lg bg-white border border-gray-200/80 px-3 py-1.5">
              {common.lastUpdatedLabel} {common.lastUpdatedDate}
            </span>
          </div>
        </header>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar TOC */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 min-w-0 print:hidden">
            <div className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-gray-900">
                  {common.tableOfContents}
                </h2>
              </div>

              <nav aria-label={common.tableOfContents} className="space-y-1">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex min-h-[40px] items-center justify-between rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:bg-emerald-50/70 hover:text-emerald-700 transition-colors"
                  >
                    <span className="truncate">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 ms-2 opacity-0 group-hover:opacity-100 rtl:rotate-180 text-emerald-600 transition-opacity" />
                  </a>
                ))}
              </nav>

              <div className="pt-4 border-t border-gray-100 space-y-2.5 text-xs">
                <p className="font-bold text-gray-800">{common.needHelpTitle}</p>
                <Link
                  href="/contact"
                  className="inline-flex min-h-[40px] items-center gap-1.5 font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{common.contactSupport}</span>
                </Link>
                {supportEmail && (
                  <p className="text-gray-500 break-all">
                    {common.directEmailLabel}{" "}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-mono text-gray-700 hover:text-emerald-600 underline"
                      dir="ltr"
                    >
                      {supportEmail}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Document Body */}
          <div className="lg:col-span-8 min-w-0">
            <article className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 lg:p-10 shadow-sm space-y-10 text-gray-600 leading-relaxed text-sm sm:text-base">
              {children}
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}
