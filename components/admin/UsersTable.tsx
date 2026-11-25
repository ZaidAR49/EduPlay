"use client"

import { useState, useTransition, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Ban,
  CheckCircle,
  Eye,
  Zap,
  ZapOff,
  UserPlus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ArrowDownUp,
  Activity,
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import { ConfirmModal } from "@/components/shared/ConfirmModal"
import { UserDetailsModal } from "./UserDetailsModal"
import { AddUserModal } from "./AddUserModal"
import {
  addNormalUserAction,
  toggleUserSubscriptionAction,
  toggleUserBlockAction,
  deleteUserAction,
} from "@/lib/actions/admin.actions"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useLocale } from "@/lib/i18n/LanguageContext"
import { hasPermission } from "@/lib/auth/permissions"
import { formatAdminDate, formatRelativeActivity } from "@/lib/utils"

type UsersSummary = {
  totalUsers: number
  active7d: number
  blocked: number
  inactive: number
}

function ActivityStatusBadge({
  activityStatus,
  t,
  isRTL,
}: {
  activityStatus: string
  t: any
  isRTL: boolean
}) {
  if (activityStatus === "blocked") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {t.adminAccounts.statusLocked}
      </span>
    )
  }
  if (activityStatus === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {t.adminAccounts.statusActive}
      </span>
    )
  }
  if (activityStatus === "idle") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {t.adminAccounts.statusIdle || (isRTL ? "خامل (8-30 يوم)" : "Idle (8-30d)")}
      </span>
    )
  }
  if (activityStatus === "inactive") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {t.adminAccounts.statusInactive || (isRTL ? "غير نشط (+30 يوم)" : "Inactive (30d+)")}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-xs font-medium border border-zinc-200">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      {t.adminAccounts.statusNever || (isRTL ? "لم ينشط بعد" : "Never Active")}
    </span>
  )
}

export function UsersTable({
  userRole,
  initialUsers,
  totalPages,
  currentPage,
  currentSearch,
  currentFilter,
  currentSort,
  summary,
}: {
  userRole: string
  initialUsers: any[]
  totalPages: number
  currentPage: number
  currentSearch: string
  currentFilter: string
  currentSort: string
  summary?: UsersSummary
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t, locale, isRTL } = useLocale()

  const canCreateUsers = hasPermission(userRole, "users:create")
  const canBlockUsers = hasPermission(userRole, "users:block")
  const canManageBilling = hasPermission(userRole, "users:billing")
  const canDeleteUsers = hasPermission(userRole, "users:delete")

  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch)
  const [filter, setFilter] = useState<string>(currentFilter)
  const [sort, setSort] = useState(
    currentSort === "recent_login" ? "recent_active" : currentSort
  )
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "subscribe" | "block" | "unblock" | null
    user: any | null
  }>({ type: null, user: null })

  useEffect(() => {
    setSearch(currentSearch)
    setFilter(currentFilter)
    setSort(currentSort === "recent_login" ? "recent_active" : currentSort)
  }, [currentSearch, currentFilter, currentSort])

  useEffect(() => {
    if (search === currentSearch) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search) params.set("q", search)
      else params.delete("q")
      params.set("page", "1")
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [search, currentSearch, pathname, router, searchParams])

  const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await addNormalUserAction(formData)
        setIsAddUserModalOpen(false)
        toast.success(isRTL ? "تمت إضافة المستخدم بنجاح" : "User added successfully")
      } catch (err: any) {
        console.error(err)
        toast.error(err?.message || (isRTL ? "حدث خطأ أثناء إضافة المستخدم" : "Failed to add user"))
      }
    })
  }

  const handleSortChange = (newSort: string) => {
    setSort(newSort)
    const params = new URLSearchParams(searchParams.toString())
    params.set("s", newSort)
    params.set("page", "1")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const handleFilterChange = (f: string) => {
    setFilter(f)
    const params = new URLSearchParams(searchParams.toString())
    if (f !== "all") params.set("f", f)
    else params.delete("f")
    params.set("page", "1")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const executeSubscriptionToggle = () => {
    if (!confirmAction.user) return
    const { id: userId, plan } = confirmAction.user
    startTransition(async () => {
      try {
        await toggleUserSubscriptionAction(userId, plan !== "pro")
        toast.success(isRTL ? "تم تحديث باقة المستخدم" : "Subscription updated")
      } catch (err: any) {
        console.error(err)
        toast.error(err?.message || (isRTL ? "فشل تحديث الباقة" : "Failed to update subscription"))
      } finally {
        setConfirmAction({ type: null, user: null })
      }
    })
  }

  const executeBlockToggle = () => {
    if (!confirmAction.user) return
    const { id: userId, isLocked } = confirmAction.user
    const nextLocked = !isLocked
    startTransition(async () => {
      try {
        await toggleUserBlockAction(userId, nextLocked)
        toast.success(
          nextLocked
            ? (isRTL ? "تم حظر المستخدم" : "User blocked")
            : (isRTL ? "تم إلغاء حظر المستخدم" : "User unblocked")
        )
      } catch (err: any) {
        console.error(err)
        toast.error(err?.message || (isRTL ? "فشل تنفيذ الإجراء" : "Failed to update block status"))
      } finally {
        setConfirmAction({ type: null, user: null })
      }
    })
  }

  const executeDelete = () => {
    if (!confirmAction.user) return
    startTransition(async () => {
      try {
        await deleteUserAction(confirmAction.user.id)
        toast.success(isRTL ? "تم حذف الحساب بنجاح" : "User deleted")
      } catch (err: any) {
        console.error(err)
        toast.error(err?.message || (isRTL ? "فشل حذف المستخدم" : "Failed to delete user"))
      } finally {
        setConfirmAction({ type: null, user: null })
      }
    })
  }

  const filterTabs = [
    { key: "all", label: t.adminAccounts.filterAll, count: summary?.totalUsers },
    { key: "active", label: t.adminAccounts.filterActive || (isRTL ? "نشط (7 أيام)" : "Active (7d)"), count: summary?.active7d },
    { key: "inactive", label: t.adminAccounts.filterInactive || (isRTL ? "خامل (+30 يوم)" : "Inactive (30d+)"), count: summary?.inactive },
    { key: "pro", label: t.adminAccounts.filterPro, icon: Zap },
    { key: "locked", label: t.adminAccounts.filterLocked, icon: Ban, count: summary?.blocked },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400`} />
            <input
              type="text"
              placeholder={t.adminAccounts.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm`}
            />
          </div>
          {canCreateUsers && (
            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-5 h-5" /> <span>{t.adminAccounts.addUser}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 overflow-x-auto w-fit max-w-full">
            {filterTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => handleFilterChange(tab.key)}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    filter === tab.key
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500 flex items-center gap-1">
              <ArrowDownUp className="w-4 h-4" /> {t.adminAccounts.sortBy}
            </span>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="newest">{t.adminAccounts.sortNewest}</option>
              <option value="oldest">{t.adminAccounts.sortOldest}</option>
              <option value="recent_active">{t.adminAccounts.sortRecentLogin}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-start">
          <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-start">{t.adminAccounts.thUser}</th>
              <th className="px-6 py-4 text-start">{t.adminAccounts.thPlan}</th>
              <th className="px-6 py-4 text-start">{t.adminAccounts.thStatus}</th>
              <th className="px-6 py-4 text-start">{t.adminAccounts.thDate}</th>
              <th className="px-6 py-4 text-start">{t.adminAccounts.thLastActive || (isRTL ? "آخر نشاط" : "Last Active")}</th>
              <th className="px-6 py-4 text-center">{t.adminAccounts.thActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 relative">
            {isPending && (
              <tr className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm rounded-b-2xl">
                <td colSpan={6} className="h-full">
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                </td>
              </tr>
            )}
            {initialUsers.map((user, idx) => {
              const displayName = user.name || user.email || "User"
              const relActive = formatRelativeActivity(user.lastActiveAt, locale)
              return (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{displayName}</div>
                        <div className="text-slate-500 text-xs mt-0.5 truncate" dir="ltr">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.plan === "pro" ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                        {t.adminAccounts.planPro}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        {t.adminAccounts.planFree}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <ActivityStatusBadge activityStatus={user.activityStatus} t={t} isRTL={isRTL} />
                  </td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap" suppressHydrationWarning>
                    <div className="text-xs font-medium text-slate-800">
                      {formatAdminDate(user.createdAt, locale)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatAdminDate(user.createdAt, locale, { includeTime: true })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap" suppressHydrationWarning>
                    {user.lastActiveAt ? (
                      <div>
                        <div className="text-xs font-medium text-slate-800 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-slate-400" />
                          <span>{relActive}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatAdminDate(user.lastActiveAt, locale, { includeTime: true })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {isRTL ? "لم ينشط بعد" : "Never"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t.adminAccounts.viewDetails}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canManageBilling && (
                        <button
                          onClick={() => setConfirmAction({ type: "subscribe", user })}
                          className={`p-2 rounded-lg transition-colors ${
                            user.plan === "pro"
                              ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                              : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          }`}
                          title={user.plan === "pro" ? t.adminAccounts.downgradePro : t.adminAccounts.upgradePro}
                        >
                          {user.plan === "pro" ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                        </button>
                      )}
                      {canBlockUsers && (
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: user.isLocked ? "unblock" : "block",
                              user,
                            })
                          }
                          className={`p-2 rounded-lg transition-colors ${
                            user.isLocked
                              ? "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          }`}
                          title={user.isLocked ? t.adminAccounts.unblockUser : t.adminAccounts.blockUser}
                        >
                          {user.isLocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                      )}
                      {canDeleteUsers && (
                        <button
                          onClick={() => setConfirmAction({ type: "delete", user })}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t.adminAccounts.deleteUser}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
        {initialUsers.length === 0 && (
          <div className="p-12 text-center text-slate-500">{t.adminAccounts.noUsersFound}</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 p-5 bg-white border-t border-slate-100 rounded-b-2xl">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isPending}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNum = i + 1
            if (
              totalPages > 7 &&
              pageNum !== 1 &&
              pageNum !== totalPages &&
              Math.abs(pageNum - currentPage) > 1
            ) {
              if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return (
                  <span key={i} className="w-9 h-9 flex items-center justify-center text-slate-400">
                    ...
                  </span>
                )
              }
              return null
            }

            return (
              <button
                key={i}
                onClick={() => handlePageChange(pageNum)}
                disabled={isPending}
                className={`w-9 h-9 rounded-xl font-bold transition-colors ${
                  currentPage === pageNum
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {pageNum}
              </button>
            )
          })}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isPending}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {selectedUser && <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {isAddUserModalOpen && (
          <AddUserModal
            isPending={isPending}
            canAssignPro={canManageBilling}
            onClose={() => setIsAddUserModalOpen(false)}
            onSubmit={handleAddUser}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmAction.type === "subscribe"}
        onClose={() => setConfirmAction({ type: null, user: null })}
        onConfirm={executeSubscriptionToggle}
        title={t.adminAccounts.confirmSubscribeTitle}
        description={t.adminAccounts.confirmSubscribeMsg
          .replace("{name}", confirmAction.user?.name || "")
          .replace("{plan}", confirmAction.user?.plan === "pro" ? t.adminAccounts.planFree : t.adminAccounts.planPro)}
        confirmText={isRTL ? "تأكيد" : "Confirm"}
        cancelText={isRTL ? "إلغاء" : "Cancel"}
        type="warning"
      />
      <ConfirmModal
        isOpen={confirmAction.type === "block" || confirmAction.type === "unblock"}
        onClose={() => setConfirmAction({ type: null, user: null })}
        onConfirm={executeBlockToggle}
        title={confirmAction.user?.isLocked ? t.adminAccounts.confirmUnblockTitle : t.adminAccounts.confirmBlockTitle}
        description={
          confirmAction.user?.isLocked
            ? t.adminAccounts.confirmUnblockMsg.replace("{name}", confirmAction.user?.name || "")
            : t.adminAccounts.confirmBlockMsg.replace("{name}", confirmAction.user?.name || "")
        }
        confirmText={isRTL ? "تأكيد" : "Confirm"}
        cancelText={isRTL ? "إلغاء" : "Cancel"}
        type={confirmAction.type === "block" ? "danger" : "warning"}
      />
      <ConfirmModal
        isOpen={confirmAction.type === "delete"}
        onClose={() => setConfirmAction({ type: null, user: null })}
        onConfirm={executeDelete}
        title={t.adminAccounts.confirmDeleteTitle}
        description={t.adminAccounts.confirmDeleteMsg.replace("{name}", confirmAction.user?.name || "")}
        confirmText={isRTL ? "حذف" : "Delete"}
        cancelText={isRTL ? "إلغاء" : "Cancel"}
        type="danger"
      />
    </div>
  )
}
