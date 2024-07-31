
import ChatTreePluginSettings, { PluginSettings, DEFAULT_SETTINGS } from '@/settings'
import { Plugin, View, ItemView } from 'obsidian'
import { Logger } from '@/util/logging'
import { around } from "monkey-around"
import { Canvas } from './obsidian/canvas-internal'
import { addGenerateCompletion, addGenerateFollowUp } from '@/actions/menu'
import { AINote } from '@/actions/create-ai-note'


interface CanvasView extends View {
    canvas: Canvas
}

/**
 * Obsidian plugin implementation.
 * Note: Canvas has no supported API. This plugin uses internal APIs that may change without notice.
 */
export default class ChatTreePlugin extends Plugin {
    settings: PluginSettings
    logDebug: Logger

    // constructor(app: App, pluginManifest: PluginManifest, pluginPath: string) {
    //     super(app, pluginManifest)
    // }

    async onload() {
        await this.loadSettings()
        this.addSettingTab(new ChatTreePluginSettings(this.app, this))
        this.app.workspace.onLayoutReady(() => {
            this.addCanvasMenu()
        })

        this.logDebug = this.settings.debug
            ? (message?: unknown, ...optionalParams: unknown[]) =>
                console.debug('Chat Tree: ' + message, ...optionalParams)
            : () => { }

        this.logDebug('Debug logging enabled')

        const generator = AINote(this.app, this.settings, this.logDebug)

        this.addCommand({
            id: 'next-note',
            name: 'Create next note',
            callback: () => {
                generator.nextNote()
            },
            hotkeys: [
                {
                    modifiers: ['Alt', 'Shift'],
                    key: 'N'
                }
            ]
        })

        this.addCommand({
            id: 'generate-note-openai',
            name: 'Generate AI note with OpenAI',
            callback: () => {
                generator.generateNote()
            },
            hotkeys: [
                {
                    modifiers: ['Alt', 'Shift'],
                    key: 'G'
                }
            ]
        })

        this.addCommand({
            id: 'generate-note-search',
            name: 'Generate AI note with search',
            callback: () => {
                generator.generateSearchNote()
            },
            hotkeys: [
                {
                    modifiers: ['Alt', 'Shift'],
                    key: 'F'
                }
            ]
        })
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }

    addCanvasMenu() {
        const app = this.app
        const settings = this.settings
        const logDebug = this.logDebug


        const addToMenu = () => {
            const canvasView = app.workspace.getLeavesOfType("canvas").first()?.view
            if (!canvasView) return false

            const menu = (canvasView as CanvasView).canvas.menu
            if (!menu) return false

            const selection = menu.selection
            if (!selection) return false

            const uninstall = around(menu.constructor.prototype, {
                // @ts-ignore
                render: (next) => function (...args) {
                    const result = next.call(this, ...args)

                    const maybeCanvasView = app.workspace.getActiveViewOfType(ItemView) as CanvasView | null
                    // if no canvas view or multiple selection, return original menu
                    if (!maybeCanvasView || maybeCanvasView.canvas?.selection?.size !== 1) return result

                    // Check if the custom menu item is already added
                    if (this.menuEl.querySelector(".gpt-menu-item")) return result

                    const selectedNode = Array.from(maybeCanvasView.canvas?.selection)[0]

                    logDebug("Selected node", selectedNode)



                    // If the selected node is an user node (has no color) and has an edge with assigned color node
                    // if (!selectedNode.color && selectedNode.edges.size > 0) {
                    //     addRegenerateCompletion(app, settings, this.menuEl, this.logDebug)
                    // } else {
                    addGenerateCompletion(app, settings, this.menuEl, this.logDebug)
                    addGenerateFollowUp(app, settings, this.menuEl, this.logDebug)
                    // }
                }
            })

            this.register(() => uninstall())
            return true

        }

        this.app.workspace.onLayoutReady(() => {
            if (!addToMenu()) {
                // If patchMenu fails, try again on layout change
                const evt = this.app.workspace.on("layout-change", () => {
                    addToMenu() && this.app.workspace.offref(evt)
                })
                this.registerEvent(evt)
            }
        })

    }
    addContextMenu() { }
    addCommands() { }

}
