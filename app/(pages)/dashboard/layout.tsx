import type { Metadata } from "next"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { SystemAnnouncementsBanner } from "@/components/dashboard/SystemAnnouncementsBanner"
import { requireAuth } from "@/lib/actions/utils"
import { NOINDEX_ROBOTS } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Teacher Dashboard",
  robots: NOINDEX_ROBOTS,
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="lg:ps-64 rtl:lg:pr-64 ltr:lg:pl-64 pt-16 lg:pt-0">
        {/* Main Content Area */}
        <div className="p-4 lg:p-8 mx-auto max-w-7xl">
          <SystemAnnouncementsBanner />
          {children}
        </div>
      </main>
    </div>
  )
}
