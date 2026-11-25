"use client"

import { HelpCircle } from "lucide-react"
import { useLocale } from "@/lib/i18n/LanguageContext"

/**
 * Visible, crawler-friendly FAQ section aligned 1:1 with the homepage FAQPage JSON-LD schema.
 */
export function FAQSection() {
  const { messages: t } = useLocale()
  const faq = t.faq

  return (
    <section id="faq" className="py-20 bg-white relative overflow-hidden border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs mb-4 border border-emerald-100">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{faq.sectionBadge}</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-5 leading-tight">
            {faq.sectionHeading1}{" "}
            <span className="text-transparent bg-clip-text rtl:bg-gradient-to-l ltr:bg-gradient-to-r from-emerald-600 to-blue-600">
              {faq.sectionHeading2}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            {faq.sectionDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faq.items.map((item, index) => (
            <article
              key={index}
              className="rounded-3xl bg-gray-50/70 border border-gray-100 hover:border-emerald-200 hover:bg-white p-6 sm:p-7 transition-all duration-300 text-start shadow-2xs"
            >
              <h3 className="text-base sm:text-lg font-black text-gray-900 mb-3 leading-snug">
                {item.question}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
