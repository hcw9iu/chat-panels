"use client"

import { useState, useCallback, useMemo } from "react"
import { HeaderBar } from "@/components/header-bar"
import { ChatPanel } from "@/components/chat-panel"
import { MessageInput } from "@/components/message-input"
import { LanguageSelector } from "@/components/language-selector"
import { PlaygroundSkeleton } from "@/components/playground-skeleton"
import { usePlayground } from "@/hooks/use-playground"
import { useTemplates } from "@/hooks/use-templates"
import {
  Github,
} from "lucide-react"
import {
  getAllProviders
} from "@/lib/ai-providers/registry"

export default function PlaygroundPage() {
  const {
    settings,
    panels,
    draft,
    setDraft,
    hydrated,
    updateApiKey,
    updateModel,
    updatePanelCount,
    updatePanelTitle,
    updateSystemPrompt,
    clearAllChats,
    clearApiKey,
    resetSystemPrompts,
    resetPanels,
    clearEverything,
    sendMessage,
    updatePanelConfig,
    updateDifyInputs,
    refreshDifyParameters,
    registerDifyApp,
    removeDifyApp,
    updateActiveProvider,
    updateProviderConfig,
    updateProviderModels,
    togglePanelMode,
  } = usePlayground()

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

  // Get available models for active provider
  const activeProvider = getAllProviders().find(p => p.id === settings.activeProviderId)
  const availableModels = (settings.providerConfigs?.[settings.activeProviderId]?.models || activeProvider?.models || []).map(m => ({
    id: m.id,
    label: m.label || m.id, // Ensure label exists
    description: m.description
  }))

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
    <div className="flex h-dvh bg-background overflow-hidden relative flex-col">
      {/* Floating Header */}
      <div className="shrink-0 relative z-20">
        <HeaderBar
          settings={settings}
          onUpdateApiKey={updateApiKey}
          onUpdatePanelCount={updatePanelCount}
          onClearChats={clearAllChats}
          onClearApiKey={clearApiKey}
          onResetPrompts={resetSystemPrompts}
          onClearEverything={clearEverything}
          onExportAllChats={exportAllChats}
          setMobilePromptOpen={setMobilePromptOpen}
          templates={templateStore.templates}
          onApplyTemplate={
            currentMobilePanel
              ? (content: string) => updateSystemPrompt(currentMobilePanel.id, content)
              : undefined
          }
          templateStore={templateStore}
          updateActiveProvider={updateActiveProvider}
          updateProviderConfig={updateProviderConfig}
          updateProviderModels={updateProviderModels}
          togglePanelMode={togglePanelMode}
          onRegisterDifyApp={registerDifyApp}
          onRemoveDifyApp={removeDifyApp}
          onResetPanels={resetPanels}
          panels={panels}
          updatePanelConfig={updatePanelConfig}
        />
      </div>

      {/* ============ PANELS ============ */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 p-2 md:p-3">
          {renderBinarySplit(activePanels.map((panel, idx) => ({ panel, idx })))}
        </div>
      </div>



      {/* Global Input (Overlay) */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <MessageInput
          onSend={sendMessage}
          disabled={!hasApiKey}
          isAnyPanelLoading={isAnyPanelLoading}
          model={settings.activeModelId}
          availableModels={availableModels}
          onUpdateModel={updateModel}
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
        />
      </div>

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
  )
}
