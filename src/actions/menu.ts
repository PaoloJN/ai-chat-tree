import { App, setIcon, setTooltip } from "obsidian"
import { PluginSettings } from '@/settings'
import { Logger } from '@/util/logging'

export const addGenerateCompletion = async (app: App, settings: PluginSettings, menuEl: HTMLElement, logDebug: Logger) => {
    const button = createEl("button", "clickable-icon gpt-menu-item")
    setTooltip(button, "Generate Response", { placement: "top" })
    setIcon(button, "lucide-sparkles")
    menuEl.appendChild(button)
    button.addEventListener("click", () => {
        logDebug("Generate Response")
    })

    // button.addEventListener("click", () => handleGenerateCompletion(app, settings))
}

export const addGenerateFollowUp = async (app: App, settings: PluginSettings, menuEl: HTMLElement, logDebug: Logger) => {
    const button = createEl("button", "clickable-icon gpt-menu-item")
    setTooltip(button, "Generate follow-up Question", { placement: "top" })
    setIcon(button, "lucide-plus-circle")
    menuEl.appendChild(button)
    button.addEventListener("click", () => {
        logDebug("Generate follow-up Question")
    })

    // button.addEventListener("click", () => handleGenerateFollowUp(app, settings))
}



export const addRegenerateCompletion = async (app: App, settings: PluginSettings, menuEl: HTMLElement, logDebug: Logger) => {
    const button = createEl("button", "clickable-icon gpt-menu-item")
    setTooltip(button, "Regenerate Response", { placement: "top" })
    setIcon(button, "lucide-rotate-cw")
    menuEl.appendChild(button)
    button.addEventListener("click", () => {
        logDebug("Regenerate Response")
    })

    // button.addEventListener("click", () => handleRegenerateCompletion(app, settings))
}
