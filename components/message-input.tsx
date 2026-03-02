"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  ArrowUp,
  Settings2,
  Paperclip,
  X,
  Loader2,
  KeyRound
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { PanelState } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { useTheme } from "next-themes"

interface MessageInputProps {
  onSend: (message: string, fileId?: string, targetPanelId?: number) => void
  disabled?: boolean
  isAnyPanelLoading?: boolean
  draft: string
  setDraft: (value: string) => void
  mobilePanel?: PanelState
  onUpdateMobileSystemPrompt?: (prompt: string) => void
  onUpdateMobileTitle?: (title: string) => void
  mobilePromptOpen?: boolean
  setMobilePromptOpen?: (open: boolean) => void
  enablePanelMode?: boolean
  activeProviderId?: string
  onClearChats?: () => void
  sendTargets?: { id: number; label: string }[]
  panelCount?: number
  onUpdatePanelCount?: (count: number) => void
  onExportAllChats?: () => void
  onResetPanels?: () => void
  onClearEverything?: () => void
  providerConfigs?: Record<string, { apiKey?: string; baseUrl?: string }>
  apiProviders?: { id: string; name: string; defaultBaseUrl?: string }[]
  onUpdateProviderConfig?: (providerId: string, config: { apiKey?: string; baseUrl?: string }) => void
  autoFocusInput?: boolean
}

export function MessageInput({
  onSend,
  disabled,
  isAnyPanelLoading,
  draft,
  setDraft,
  mobilePanel,
  mobilePromptOpen = false,
  setMobilePromptOpen,
  enablePanelMode = false,
  activeProviderId,
  onClearChats,
  sendTargets = [],
  panelCount = 1,
  onUpdatePanelCount,
  onExportAllChats,
  onResetPanels,
  onClearEverything,
  providerConfigs = {},
  apiProviders = [],
  onUpdateProviderConfig,
  autoFocusInput = false,
}: MessageInputProps) {
  const value = draft
  const setValue = setDraft
  const [apiMenuOpen, setApiMenuOpen] = useState(false)
  const [selectedApiProviderId, setSelectedApiProviderId] = useState("openai")
  const [apiKeyDraft, setApiKeyDraft] = useState("")
  const [baseUrlDraft, setBaseUrlDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string, name: string }[]>([])
  const [targetPanel, setTargetPanel] = useState<"all" | number>("all")
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const { t } = useI18n()
  const { resolvedTheme, setTheme } = useTheme()
  const activeApiProvider = apiProviders.find((p) => p.id === selectedApiProviderId)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed && uploadedFiles.length === 0 || disabled || isAnyPanelLoading) return
    onSend(trimmed, uploadedFiles[0]?.id, targetPanel === "all" ? undefined : targetPanel)
    setValue("")
    setUploadedFiles([])
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px"
    }
  }, [value, uploadedFiles, disabled, isAnyPanelLoading, onSend, setValue, targetPanel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "44px"
      const scrollHeight = textarea.scrollHeight
      textarea.style.height = Math.min(scrollHeight, 120) + "px"
    }
  }

  useEffect(() => {
    const defaultProvider = activeProviderId || apiProviders[0]?.id || "openai"
    setSelectedApiProviderId(defaultProvider)
  }, [activeProviderId, apiProviders])

  useEffect(() => {
    const providerConfig = providerConfigs[selectedApiProviderId] || {}
    setApiKeyDraft(providerConfig.apiKey || "")
    setBaseUrlDraft(providerConfig.baseUrl || activeApiProvider?.defaultBaseUrl || "")
  }, [selectedApiProviderId, providerConfigs, activeApiProvider?.defaultBaseUrl])

  return (
    <footer className="border-none shrink-0 relative z-20 bg-gradient-to-t from-background from-45% via-background/90 to-transparent pt-8 md:pt-12 pointer-events-none">
      <div className="px-4 pb-4 max-w-3xl mx-auto pointer-events-auto">
        {/* Capsule input container */}
        <div className="bg-card border-2 border-border rounded-[28px] focus-within:border-primary/40 transition-all shadow-[0_2px_12px_rgba(62,168,255,0.06)]">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocusInput}
            placeholder={
              disabled
                ? t("enterApiKeyMsg")
                : t("enterMsg")
            }
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0",
              "px-6 pt-4 pb-1.5 text-sm text-foreground placeholder:text-muted-foreground",
              "resize-none disabled:cursor-not-allowed disabled:opacity-50 custom-scrollbar"
            )}
            style={{
              minHeight: "44px",
              maxHeight: "120px",
              overflowY: "auto",
            }}
          />

          {/* Bottom row */}
          <div className="flex items-center justify-between px-3 pb-3 relative">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">

              {/* Attachment logic for dify/others */}
              <input
                type="file"
                className="hidden"
                multiple
                ref={fileInputRef}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length === 0) return
                  setUploading(true)
                  try {
                    const newFiles = files.map((f, i) => ({ id: `local-pending-${Date.now()}-${i}`, name: f.name }))
                    setUploadedFiles(prev => [...prev, ...newFiles])
                    const currentPending = (window as any)._pendingFiles || []
                      ; (window as any)._pendingFiles = [...currentPending, ...files]
                      // Legacy single file fallback
                      ; (window as any)._pendingFile = files[0]
                  } finally {
                    setUploading(false)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }
                }}
              />
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="h-4 w-4 shrink-0" />}
              </motion.button>
              {onUpdatePanelCount && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdatePanelCount(Math.max(1, panelCount - 1))}
                    className="h-7 w-7 rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground"
                    aria-label="Decrease panels"
                  >
                    -
                  </button>
                  <span className="min-w-[18px] text-center text-xs text-muted-foreground">{panelCount}</span>
                  <button
                    type="button"
                    onClick={() => onUpdatePanelCount(Math.min(100, panelCount + 1))}
                    className="h-7 w-7 rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground"
                    aria-label="Increase panels"
                  >
                    +
                  </button>
                </div>
              )}

              {/* Attachments inline preview */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 min-w-0 pr-1">
                {uploadedFiles.map(f => (
                  <div key={f.id} className="flex-shrink-0 flex items-center gap-1 bg-muted/50 px-2 py-1.5 rounded-lg border border-border/80 h-[32px]">
                    <span className="text-[11px] text-foreground max-w-[80px] lg:max-w-[120px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFiles(prev => prev.filter(x => x.id !== f.id))
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors ml-1 p-0.5 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {sendTargets.length > 0 && (
                <div className="relative shrink-0 z-50">
                  <select
                    value={targetPanel === "all" ? "all" : String(targetPanel)}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      setTargetPanel(nextValue === "all" ? "all" : Number(nextValue))
                    }}
                    className="h-8 rounded-xl border border-border bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    title="Send target"
                  >
                    <option value="all">All Panels</option>
                    {sendTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative shrink-0 z-50">
                <motion.button
                  type="button"
                  onClick={() => setApiMenuOpen((v) => !v)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="h-8 rounded-xl border border-border bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                  title="API Key Settings"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  API
                </motion.button>
                <AnimatePresence>
                  {apiMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setApiMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute bottom-full right-0 mb-2 z-50 w-72 rounded-xl border border-border/70 bg-card shadow-lg p-3 space-y-2"
                      >
                        <select
                          value={selectedApiProviderId}
                          onChange={(e) => setSelectedApiProviderId(e.target.value)}
                          className="w-full h-8 rounded-lg border border-border/60 bg-background px-2 text-xs text-foreground"
                        >
                          {apiProviders.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <input
                          type="password"
                          value={apiKeyDraft}
                          onChange={(e) => setApiKeyDraft(e.target.value)}
                          className="w-full h-8 rounded-lg border border-border/60 bg-background px-2 text-xs text-foreground"
                          placeholder="API Key"
                        />
                        <input
                          type="text"
                          value={baseUrlDraft}
                          onChange={(e) => setBaseUrlDraft(e.target.value)}
                          className="w-full h-8 rounded-lg border border-border/60 bg-background px-2 text-xs text-foreground"
                          placeholder="Base URL (optional)"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProviderConfig?.(selectedApiProviderId, {
                              apiKey: apiKeyDraft.trim(),
                              baseUrl: baseUrlDraft.trim(),
                            })
                            setApiMenuOpen(false)
                          }}
                          className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                        >
                          Save
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative shrink-0">
                <motion.button
                  type="button"
                  onClick={() => setSettingsMenuOpen((v) => !v)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors"
                  aria-label="Open settings menu"
                  title="Settings"
                >
                  <Settings2 className="h-4 w-4" />
                </motion.button>
                <AnimatePresence>
                  {settingsMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSettingsMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute bottom-full right-0 mb-2 z-50 w-56 rounded-xl border border-border/70 bg-card shadow-lg p-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setTheme(resolvedTheme === "dark" ? "light" : "dark")
                            setSettingsMenuOpen(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50 text-foreground"
                        >
                          Theme: {resolvedTheme === "dark" ? "Dark" : "Light"}
                        </button>
                        {onExportAllChats && (
                          <button
                            type="button"
                            onClick={() => {
                              onExportAllChats()
                              setSettingsMenuOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50 text-foreground"
                          >
                            Export All Chats
                          </button>
                        )}
                        {onClearChats && (
                          <button
                            type="button"
                            onClick={() => {
                              onClearChats()
                              setSettingsMenuOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50 text-foreground"
                          >
                            Clear Chats
                          </button>
                        )}
                        {onResetPanels && (
                          <button
                            type="button"
                            onClick={() => {
                              onResetPanels()
                              setSettingsMenuOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50 text-foreground"
                          >
                            Reset Panels
                          </button>
                        )}
                        {onClearEverything && (
                          <button
                            type="button"
                            onClick={() => {
                              onClearEverything()
                              setSettingsMenuOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-destructive/10 text-destructive"
                          >
                            Clear Everything
                          </button>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile: system prompt button removed, now in chat-panel directly */}
            </div>

            {/* Send button */}
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={(!value.trim() && uploadedFiles.length === 0) || disabled || isAnyPanelLoading}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={cn(
                "p-2.5 rounded-full transition-all",
                "bg-primary text-primary-foreground",
                "disabled:opacity-25 disabled:cursor-not-allowed"
              )}
              aria-label="Send"
            >
              {isAnyPanelLoading ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </footer>
  )
}
