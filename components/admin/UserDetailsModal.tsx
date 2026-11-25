"use client"

import { motion } from "framer-motion"
import {
  Building2,
  Gamepad2,
  Users,
  Copy,
  Check,
  Clock,
  BrainCircuit,
  KeySquare,
  Calendar,
  Activity,
  Loader2,
  UserCheck,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useLocale } from "@/lib/i18n/LanguageContext"
import { formatAdminDate, formatRelativeActivity } from "@/lib/utils"
import { getUserActivityDetailsAction } from "@/lib/actions/admin.actions"

type UserDetailsModalProps = {
  user: any
  onClose: () => void
}

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  user_login: { ar: "تسجيل دخول", en: "Signed in" },
  game_created: { ar: "إنشاء لعبة", en: "Created game" },
  game_updated: { ar: "تعديل لعبة", en: "Updated game" },
  game_published: { ar: "نشر لعبة", en: "Published game" },
  game_session_closed: { ar: "إغلاق جلسة لعب", en: "Closed game session" },
  game_deleted: { ar: "حذف لعبة", en: "Deleted game" },
  sessions_deleted: { ar: "حذف جلسات", en: "Deleted sessions" },
  session_started: { ar: "بدء جلسة صفية", en: "Started classroom session" },
  organization_created: { ar: "إنشاء مؤسسة", en: "Created organization" },
  organization_deleted: { ar: "حذف مؤسسة", en: "Deleted organization" },
  ai_game_generated: { ar: "توليد لعبة بالذكاء الاصطناعي", en: "AI generated game" },
  ai_organization_improved: { ar: "تحسين نصوص المؤسسة بالذكاء الاصطناعي", en: "AI improved org copy" },
  ai_text_generated: { ar: "استخدام الذكاء الاصطناعي", en: "AI text generation" },
  admin_user_created: { ar: "إضافة الحساب من الإدارة", en: "Account created by staff" },
  admin_user_blocked: { ar: "حظر الحساب", en: "Account blocked" },
  admin_user_unblocked: { ar: "إلغاء حظر الحساب", en: "Account unblocked" },
  admin_user_plan_changed: { ar: "تغيير باقة الاشتراك", en: "Subscription plan updated" },
  admin_notification_sent: { ar: "إرسال إشعار", en: "Notification sent" },
  admin_staff_added: { ar: "منح صلاحية إدارية", en: "Granted staff role" },
  admin_staff_updated: { ar: "تعديل صلاحية إدارية", en: "Updated staff role" },
  admin_staff_blocked: { ar: "حظر موظف إداري", en: "Staff member blocked" },
  admin_staff_unblocked: { ar: "إلغاء حظر موظف إداري", en: "Staff member unblocked" },
  admin_staff_removed: { ar: "إزالة الصلاحية الإدارية", en: "Removed staff role" },
}

export function UserDetailsModal({ user, onClose }: UserDetailsModalProps) {
  const { locale, isRTL } = useLocale()
  const [copied, setCopied] = useState(false)
  const [loadingActions, setLoadingActions] = useState(true)
  const [timeline, setTimeline] = useState<
    Array<{
      id: string
      action: string
      detail: string | null
      actorName: string | null
      createdAt: string
    }>
  >([])

  useEffect(() => {
    let active = true
    setLoadingActions(true)
    getUserActivityDetailsAction(user.id)
      .then((res) => {
        if (active) setTimeline(res.timeline)
      })
      .catch((err) => console.error("Failed to fetch user activity:", err))
      .finally(() => {
        if (active) setLoadingActions(false)
      })
    return () => {
      active = false
    }
  }, [user.id])

  const handleCopy = () => {
    navigator.clipboard.writeText(user.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayName = user.name || user.email || "User"
  const lastActiveRel = formatRelativeActivity(user.lastActiveAt, locale)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            {isRTL ? "تفاصيل وسجل نشاط الحساب" : "Account Details & Activity"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-lg font-bold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 truncate">{displayName}</div>
              <div className="text-slate-500 text-sm truncate" dir="ltr">{user.email}</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-md border border-slate-200 truncate flex-1" dir="ltr">
                  {user.id}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-md transition-colors border border-slate-200 shrink-0"
                  title={isRTL ? "نسخ المعرف" : "Copy ID"}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "المنظمات" : "Organizations"}</span>
              </div>
              <div className="text-xl font-bold text-slate-800">{user.organizations}</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <Gamepad2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "الألعاب" : "Games"}</span>
              </div>
              <div className="text-xl font-bold text-slate-800">{user.games}</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 col-span-2">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <Users className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "إجمالي اللاعبين (التاريخي)" : "Total Players (Lifetime)"}</span>
              </div>
              <div className="text-xl font-bold text-slate-800">{user.totalPlayers}</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "تاريخ التسجيل" : "Registered"}</span>
              </div>
              <div className="text-xs font-bold text-slate-800" suppressHydrationWarning>
                {formatAdminDate(user.createdAt, locale, { includeTime: true })}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "آخر نشاط" : "Last Active"}</span>
              </div>
              <div className="text-xs font-bold text-slate-800" suppressHydrationWarning>
                {user.lastActiveAt
                  ? `${lastActiveRel ? `${lastActiveRel} · ` : ""}${formatAdminDate(user.lastActiveAt, locale, { includeTime: true })}`
                  : (isRTL ? "لم ينشط بعد" : "Never")}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "آخر تسجيل دخول" : "Last Sign-In"}</span>
              </div>
              <div className="text-xs font-bold text-slate-800" suppressHydrationWarning>
                {user.lastLoginAt
                  ? formatAdminDate(user.lastLoginAt, locale, { includeTime: true })
                  : (isRTL ? "غير مسجل" : "Not recorded")}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "انتهاء الاشتراك" : "Subscription Expiry"}</span>
              </div>
              <div className="text-xs font-bold text-slate-800" suppressHydrationWarning>
                {user.subscriptionExpiresAt
                  ? formatAdminDate(user.subscriptionExpiresAt, locale)
                  : (isRTL ? "غير متوفر" : "N/A")}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <BrainCircuit className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "طلبات AI (الشهر / الكلي)" : "AI Requests (Period / Total)"}</span>
              </div>
              <div className="text-lg font-bold text-slate-800">
                {user.aiRequestsCurrentPeriod ?? 0}{" "}
                <span className="text-xs font-medium text-slate-500">
                  / {user.lifetimeAiRequests ?? user.aiRequestsCurrentPeriod ?? 0}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <KeySquare className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{isRTL ? "التوكنز (الشهر / الكلي)" : "Tokens (Period / Total)"}</span>
              </div>
              <div className="text-lg font-bold text-slate-800">
                {(user.aiTokensUsedCurrentPeriod ?? 0).toLocaleString("en-US")}{" "}
                <span className="text-xs font-medium text-slate-500">
                  / {(user.lifetimeAiTokens ?? user.aiTokensUsedCurrentPeriod ?? 0).toLocaleString("en-US")}
                </span>
              </div>
            </div>
          </div>

          {/* Action Timeline */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-3">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>{isRTL ? "سجل الأنشطة والإجراءات الأخيرة" : "Recent Actions & Audit Timeline"}</span>
            </div>

            {loadingActions ? (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                {isRTL ? "لا توجد أنشطة مسجلة لهذا الحساب حتى الآن." : "No recorded actions for this account yet."}
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                {timeline.map((item) => {
                  const labelObj = ACTION_LABELS[item.action];
                  const label = labelObj
                    ? (isRTL ? labelObj.ar : labelObj.en)
                    : item.action;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800">{label}</div>
                        {(item.detail || item.actorName) && (
                          <div className="text-slate-500 truncate mt-0.5">
                            {item.detail ? item.detail : ""}
                            {item.detail && item.actorName ? " · " : ""}
                            {item.actorName
                              ? (isRTL ? `بواسطة ${item.actorName}` : `by ${item.actorName}`)
                              : ""}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0" suppressHydrationWarning>
                        {formatAdminDate(item.createdAt, locale, { includeTime: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
          >
            {isRTL ? "إغلاق" : "Close"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
