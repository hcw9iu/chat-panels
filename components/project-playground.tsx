"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChatPanel } from "@/components/chat-panel"
import { MessageInput } from "@/components/message-input"
import { LanguageSelector } from "@/components/language-selector"
import { PlaygroundSkeleton } from "@/components/playground-skeleton"
import { usePlayground } from "@/hooks/use-playground"
import { useTemplates } from "@/hooks/use-templates"
import {
  Github,
  MessageSquare,
  FolderPlus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
} from "lucide-react"
import {
  getAllProviders
} from "@/lib/ai-providers/registry"

interface ProjectMeta {
  id: string
  name: string
  createdAt: number
}

const PROJECTS_KEY = "chat-panels-projects"
const PROJECT_STORAGE_SETTINGS = "longcat-settings"
const PROJECT_STORAGE_PANELS = "longcat-panels"
const PROJECT_STORAGE_DRAFT = "longcat-draft"

export default function ProjectPlayground({ projectId }: { projectId: string }) {
  const router = useRouter()
  const {
    settings,
    panels,
    draft,
    setDraft,
    hydrated,
    updatePanelCount,
    updatePanelTitle,
    updateSystemPrompt,
    clearAllChats,
    resetPanels,
    clearEverything,
    sendMessage,
    updatePanelConfig,
    updateDifyInputs,
    refreshDifyParameters,
    registerDifyApp,
    updateProviderConfig,
  } = usePlayground(projectId)

  const templateStore = useTemplates()

  const exportAllChats = useCallback(() => {
    let content = "# All Chats Export\n\n"
    panels.forEach((p, i) => {
      content += `## Panel ${i + 1}: ${p.title}\n`
      content += `System Prompt: ${p.systemPrompt}\n\n`
      p.messages.forEach(m => {
        content += `### ${m.role === "user" ? "User" : "Assistant"}\n${m.content}\n\n`
      })
      content += `---\n\n`
    })
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat_export_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [panels])

  const exportPanelChats = useCallback((panelId: number) => {
    const p = panels.find((x) => x.id === panelId)
    if (!p) return
    let content = `# ${p.title}\n\n`
    content += `System Prompt: ${p.systemPrompt}\n\n`
    p.messages.forEach(m => {
      content += `### ${m.role === "user" ? "User" : "Assistant"}\n${m.content}\n\n`
    })
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${p.title}_export_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [panels])

  const isAnyPanelLoading = panels.some((p) => p.isLoading)
  const count = settings.panelCount

  // Check if current provider has API key
  const currentProviderConfig = settings.providerConfigs?.[settings.activeProviderId]
  let hasApiKey = !!currentProviderConfig?.apiKey
  if (settings.activeProviderId === "dify") {
    hasApiKey = (currentProviderConfig?.difyApps?.length || 0) > 0
  }

  const effectiveProviders = useMemo(() => {
    return getAllProviders().map(p => {
      const dynamic = settings.providerConfigs?.[p.id]?.models
      return {
        id: p.id,
        name: p.name,
        models: (dynamic && dynamic.length > 0 ? dynamic : p.models).map(m => ({
          id: m.id,
          label: m.label || m.id,
          description: m.description
        }))
      }
    })
  }, [settings.providerConfigs])

  const [mobilePromptOpen, setMobilePromptOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectNameDraft, setProjectNameDraft] = useState("")

  useEffect(() => {
    if (!hydrated) return
    try {
      const raw = localStorage.getItem(PROJECTS_KEY)
      const parsed = raw ? (JSON.parse(raw) as ProjectMeta[]) : []
      const hasCurrent = parsed.some((p) => p.id === projectId)
      const withCurrent = hasCurrent
        ? parsed
        : [{ id: projectId, name: `Project ${projectId.slice(0, 6)}`, createdAt: Date.now() }, ...parsed]
      setProjects(withCurrent)
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(withCurrent))
    } catch {
      const fallback = [{ id: projectId, name: `Project ${projectId.slice(0, 6)}`, createdAt: Date.now() }]
      setProjects(fallback)
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(fallback))
    }
  }, [hydrated, projectId])

  const createProject = useCallback(() => {
    const id = `p_${Date.now().toString(36)}`
    const next = [{ id, name: `Project ${projects.length + 1}`, createdAt: Date.now() }, ...projects]
    setProjects(next)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next))
    router.push(`/projects/${id}`)
  }, [projects, router])

  const openProject = useCallback((id: string) => {
    if (id === projectId) return
    router.push(`/projects/${id}`)
  }, [projectId, router])

  const persistProjects = useCallback((next: ProjectMeta[]) => {
    setProjects(next)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next))
  }, [])

  const startRenameProject = useCallback((project: ProjectMeta) => {
    setEditingProjectId(project.id)
    setProjectNameDraft(project.name)
  }, [])

  const commitRenameProject = useCallback((id: string) => {
    const trimmed = projectNameDraft.trim()
    if (!trimmed) {
      setEditingProjectId(null)
      return
    }
    const next = projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
    persistProjects(next)
    setEditingProjectId(null)
  }, [projectNameDraft, projects, persistProjects])

  const removeProject = useCallback((id: string) => {
    const next = projects.filter((p) => p.id !== id)
    const fallbackProject: ProjectMeta = {
      id: `p_${Date.now().toString(36)}`,
      name: "Project 1",
      createdAt: Date.now(),
    }
    const finalProjects = next.length > 0 ? next : [fallbackProject]
    persistProjects(finalProjects)

    localStorage.removeItem(`${PROJECT_STORAGE_SETTINGS}:${id}`)
    localStorage.removeItem(`${PROJECT_STORAGE_PANELS}:${id}`)
    localStorage.removeItem(`${PROJECT_STORAGE_DRAFT}:${id}`)

    if (id === projectId) {
      router.push(`/projects/${finalProjects[0].id}`)
    }
  }, [persistProjects, projectId, projects, router])

  const reorderProject = useCallback((id: string, direction: "up" | "down") => {
    const index = projects.findIndex((p) => p.id === id)
    if (index === -1) return
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= projects.length) return
    const next = [...projects]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    persistProjects(next)
  }, [persistProjects, projects])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault()
        setComposerOpen((v) => !v)
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault()
        setSidebarOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!hydrated) {
    return <PlaygroundSkeleton />
  }

  const activePanels = panels.slice(0, count)
  const currentMobilePanel = activePanels[0] ?? panels[0]

  const renderBinarySplit = (
    panelItems: { panel: typeof panels[number]; idx: number }[],
    depth = 0
  ) => {
    if (panelItems.length === 0) return null

    if (panelItems.length === 1) {
      const { panel, idx } = panelItems[0]
      return (
        <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
          <ChatPanel
            panel={panel}
            panelIndex={idx}
            totalPanels={count}
            onUpdateSystemPrompt={(prompt) =>
              updateSystemPrompt(panel.id, prompt)
            }
            onUpdateTitle={(title) =>
              updatePanelTitle(panel.id, title)
            }
            onExportPanel={exportPanelChats}
            onUpdateConfig={(config) => updatePanelConfig(panel.id, config)}
            enablePanelMode={settings.enablePanelMode}
            templates={templateStore.templates}
            onApplyTemplate={(content) =>
              updateSystemPrompt(panel.id, content)
            }
            availableProviders={effectiveProviders}
            onSend={(message) => sendMessage(message, undefined, panel.id)}
            difyParameters={
              panel.difyParameters ||
              settings.providerConfigs["dify"]?.difyApps?.find(a => a.apiKey === (panel.modelId || settings.activeModelId))?.parameters ||
              settings.providerConfigs["dify"]?.difyParameters
            }
            onUpdateDifyInputs={updateDifyInputs}
            onRefreshDifyParameters={refreshDifyParameters}
            onRegisterDifyApp={registerDifyApp}
            activeProviderId={settings.activeProviderId}
            isAnyPanelLoading={isAnyPanelLoading}
          />
        </div>
      )
    }

    const splitAt = Math.ceil(panelItems.length / 2)
    const firstHalf = panelItems.slice(0, splitAt)
    const secondHalf = panelItems.slice(splitAt)
    const splitDirection = depth % 2 === 0 ? "row" : "col"

    return (
      <div className={`h-full w-full min-h-0 min-w-0 flex ${splitDirection === "row" ? "flex-row" : "flex-col"} gap-2`}>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border/30">
          {renderBinarySplit(firstHalf, depth + 1)}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border/30">
          {renderBinarySplit(secondHalf, depth + 1)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh bg-background overflow-hidden relative">
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0"} transition-[width] duration-200 border-r border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden`}
      >
        <div className="h-full p-3 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projects</h2>
            <button
              onClick={createProject}
              className="h-7 w-7 rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground"
              title="New project"
            >
              <FolderPlus className="h-4 w-4 mx-auto" />
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto custom-scrollbar">
            {projects.map((p, idx) => (
              <div
                key={p.id}
                className={`w-full px-2.5 py-2 rounded-lg text-xs border ${p.id === projectId ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent hover:bg-muted/60 text-foreground"}`}
              >
                <div className="flex items-center gap-1.5">
                  {editingProjectId === p.id ? (
                    <input
                      value={projectNameDraft}
                      onChange={(e) => setProjectNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRenameProject(p.id)
                      }}
                      className="flex-1 h-7 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => openProject(p.id)}
                      className="flex-1 text-left truncate"
                      title={p.name}
                    >
                      {p.name}
                    </button>
                  )}
                  {editingProjectId === p.id ? (
                    <button
                      onClick={() => commitRenameProject(p.id)}
                      className="h-6 w-6 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground"
                      title="Save rename"
                    >
                      <Check className="h-3.5 w-3.5 mx-auto" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => reorderProject(p.id, "up")}
                        disabled={idx === 0}
                        className="h-6 w-6 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5 mx-auto" />
                      </button>
                      <button
                        onClick={() => reorderProject(p.id, "down")}
                        disabled={idx === projects.length - 1}
                        className="h-6 w-6 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5 mx-auto" />
                      </button>
                      <button
                        onClick={() => startRenameProject(p)}
                        className="h-6 w-6 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground"
                        title="Rename project"
                      >
                        <Pencil className="h-3.5 w-3.5 mx-auto" />
                      </button>
                      <button
                        onClick={() => removeProject(p.id)}
                        className="h-6 w-6 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-destructive"
                        title="Remove project"
                      >
                        <Trash2 className="h-3.5 w-3.5 mx-auto" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="flex-1 relative flex flex-col overflow-hidden">
      {/* ============ PANELS ============ */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 p-2 md:p-3">
          {renderBinarySplit(activePanels.map((panel, idx) => ({ panel, idx })))}
        </div>
      </div>



      {/* Global Input (Overlay) */}
      <button
        onClick={() => setComposerOpen((v) => !v)}
        className="fixed bottom-6 left-6 z-30 h-10 w-10 rounded-full border border-border/60 bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-foreground"
        title="Toggle message box (Ctrl+I)"
        aria-label="Toggle message box"
      >
        <MessageSquare className="h-5 w-5 mx-auto" />
      </button>
      {composerOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <MessageInput
            onSend={sendMessage}
            disabled={!hasApiKey}
            isAnyPanelLoading={isAnyPanelLoading}
            draft={draft}
            setDraft={setDraft}
            mobilePanel={currentMobilePanel}
            onUpdateMobileSystemPrompt={
              currentMobilePanel
                ? (prompt: string) =>
                  updateSystemPrompt(currentMobilePanel.id, prompt)
                : undefined
            }
            onUpdateMobileTitle={
              currentMobilePanel
                ? (title: string) =>
                  updatePanelTitle(currentMobilePanel.id, title)
                : undefined
            }
            mobilePromptOpen={mobilePromptOpen}
            setMobilePromptOpen={setMobilePromptOpen}
            enablePanelMode={settings.enablePanelMode}
            activeProviderId={settings.activeProviderId}
            onClearChats={clearAllChats}
            sendTargets={panels.slice(0, count).map((p) => ({ id: p.id, label: p.title || `Panel ${p.id + 1}` }))}
            panelCount={count}
            onUpdatePanelCount={updatePanelCount}
            onExportAllChats={exportAllChats}
            onResetPanels={resetPanels}
            onClearEverything={clearEverything}
            providerConfigs={settings.providerConfigs}
            apiProviders={getAllProviders().map((p) => ({ id: p.id, name: p.name, defaultBaseUrl: p.defaultBaseUrl || "" }))}
            onUpdateProviderConfig={updateProviderConfig}
            autoFocusInput
          />
        </div>
      )}

      {/* Floating Bottom-Right: GitHub + Language (PC Only) */}
      <div className="fixed bottom-6 right-6 hidden md:flex items-center gap-2 z-30">
        <a
          href="https://github.com/lnkiai/chat-panels"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground shadow-sm transition-colors"
          title="View on GitHub"
        >
          <Github className="h-4 w-4" />
        </a>
        <LanguageSelector />
      </div>
      </div>
    </div>
  )
}
