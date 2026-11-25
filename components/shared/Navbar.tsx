import { auth } from "@/auth"
import { getCurrentUser } from "@/lib/auth/rbac"
import { NavbarClient } from "./NavbarClient"

export async function Navbar() {
  const session = await auth()
  if (!session?.user) {
    return <NavbarClient session={null} />
  }

  const dbUser = await getCurrentUser()
  if (!dbUser || dbUser.isLocked) {
    return <NavbarClient session={null} />
  }

  const freshSession = {
    ...session,
    user: {
      ...session.user,
      id: dbUser.id,
      name: dbUser.name ?? session.user.name,
      role: dbUser.role,
      isLocked: dbUser.isLocked,
    },
  }

  return <NavbarClient session={freshSession} />
}
