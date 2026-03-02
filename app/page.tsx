"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface ProjectMeta {
  id: string
  name: string
  createdAt: number
}

const PROJECTS_KEY = "chat-panels-projects"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY)
      const projects = raw ? (JSON.parse(raw) as ProjectMeta[]) : []

      if (projects.length > 0) {
        router.replace(`/projects/${projects[0].id}`)
        return
      }

      const id = `p_${Date.now().toString(36)}`
      const initial: ProjectMeta[] = [{ id, name: "Project 1", createdAt: Date.now() }]
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(initial))
      router.replace(`/projects/${id}`)
    } catch {
      const id = `p_${Date.now().toString(36)}`
      router.replace(`/projects/${id}`)
    }
  }, [router])

  return null
}
