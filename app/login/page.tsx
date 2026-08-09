"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { AuthForm } from "@/components/auth/auth-form"

export default function LoginPage() {
  const router = useRouter()
  const { loading, user } = useAuth()

  useEffect(() => {
    if (!loading && user) {
      router.replace("/organizations")
    }
  }, [loading, user, router])

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-xl font-bold">฿</span>
        </div>
        <div className="animate-pulse text-sm font-semibold tracking-wider">
          กำลังเชื่อมต่อระบบ...
        </div>
      </div>
    )
  }

  return <AuthForm />
}
