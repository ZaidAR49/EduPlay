"use client"

import Image from "next/image"
import Link from "next/link"
import AppLogo from "@/app/icon.png"
import uiContent from "@/data/ui-content-general.json"
import { useLocale } from "@/lib/i18n/LanguageContext"

/**
 * Global site footer with platform navigation and legal links.
 */
export function Footer() {
  const { messages: t } = useLocale()
  const f = t.footer

  return (
    <footer className="bg-gray-900 text-gray-400 border-t border-gray-800 mt-auto print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-gray-800">
          {/* Brand Column */}
          <div className="sm:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-9 h-9 overflow-hidden flex items-center justify-center rounded-xl bg-gray-800/80 border border-gray-700/80 shrink-0">
                <Image
                  src={AppLogo}
                  alt={uiContent.app.name}
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <span className="text-lg font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                {uiContent.app.name}
              </span>
            </Link>

            <p className="text-sm text-gray-400 leading-relaxed max-w-md">
              {f.tagline}
            </p>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {f.platformTitle}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/#features" className="hover:text-white transition-colors">
                  {f.features}
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-white transition-colors">
                  {f.howItWorks}
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-white transition-colors">
                  {f.faq}
                </Link>
              </li>
              <li>
                <Link href="/game/demo" className="hover:text-white transition-colors">
                  {f.tryDemo}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  {f.teacherLogin}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Support Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {f.legalTitle}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {f.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  {f.termsOfService}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  {f.contactUs}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Legal Bar */}
        <div className="pt-7 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm">
          <p>{uiContent.app.copyrightText}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">
              {f.privacyPolicy}
            </Link>
            <span className="text-gray-600" aria-hidden="true">•</span>
            <Link href="/terms" className="hover:text-white transition-colors">
              {f.termsOfService}
            </Link>
            <span className="text-gray-600" aria-hidden="true">•</span>
            <Link href="/contact" className="hover:text-white transition-colors">
              {f.contactUs}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
