import { App, PluginSettingTab, Setting } from 'obsidian'
import { OPENAI_MODELS, OPENAI_COMPLETIONS_URL } from '@/ai-providers/openai'
import ChatTreePlugin from '@/main'


export interface PluginSettings {
    openAIApiKey: string
    openAIApiUrl: string
    openAIApiModel: string
    perplexityApiKey: string
    perplexityApiUrl: string
    perplexityApiModel: string
    temperature: number
    systemPrompt: string
    debug: boolean
    maxInputTokens: number
    maxResponseTokens: number
    maxDepth: number
}

const DEFAULT_PERPLEXITY_API_URL = "https://api.perplexity.ai"
const DEFAULT_PERPLEXITY_API_MODEL = "llama-3-sonar-large-32k-online"
export const DEFAULT_SYSTEM_PROMPT = `
You are a critical-thinking assistant bot. 
Consider the intent of my questions before responding.
Do not restate my information unless I ask for it. 
Do not include caveats or disclaimers.
Use step-by-step reasoning. Be brief.
`.trim()

export const DEFAULT_SETTINGS: PluginSettings = {
    openAIApiKey: '',
    openAIApiUrl: OPENAI_COMPLETIONS_URL,
    openAIApiModel: OPENAI_MODELS.GPT_35_TURBO.name,
    perplexityApiKey: '',
    perplexityApiUrl: DEFAULT_PERPLEXITY_API_URL,
    perplexityApiModel: DEFAULT_PERPLEXITY_API_MODEL,
    temperature: 1,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    debug: false,
    maxInputTokens: 0,
    maxResponseTokens: 0,
    maxDepth: 0,

}

// @ts-ignore
export function getOpenAIModels() { return Object.entries(OPENAI_MODELS).map(([, value]) => value.name) }

export default class ChatTreePluginSettings extends PluginSettingTab {
    plugin: ChatTreePlugin

    constructor(app: App, plugin: ChatTreePlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this

        containerEl.empty()

        new Setting(containerEl)
            .setName('OPENAI Model')
            .setDesc('Select the openai model to use.')
            .addDropdown((cb) => {
                getOpenAIModels().forEach((model) => {
                    cb.addOption(model, model)
                })
                cb.setValue(this.plugin.settings.openAIApiModel)
                cb.onChange(async (value) => {
                    this.plugin.settings.openAIApiModel = value
                    await this.plugin.saveSettings()
                })
            })

        new Setting(containerEl)
            .setName('OPENAI API key')
            .setDesc('The API key to use when making requests - Get from OpenAI')
            .addText((text) => {
                text.inputEl.type = 'password'
                text
                    .setPlaceholder('API Key')
                    .setValue(this.plugin.settings.openAIApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openAIApiKey = value
                        await this.plugin.saveSettings()
                    })
            })

        new Setting(containerEl)
            .setName('OPENAI API URL')
            .setDesc(
                "The chat completions URL to use."
            )
            .addText((text) => {
                text.inputEl.style.width = '300px'
                text
                    .setPlaceholder('API URL')
                    .setValue(this.plugin.settings.openAIApiUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.openAIApiUrl = value
                        await this.plugin.saveSettings()
                    })
            })


        new Setting(containerEl)
            .setName('System prompt')
            .setDesc(
                `The system prompt sent with each request to the API. \n(Note: you can override this by beginning a note stream with a note starting 'SYSTEM PROMPT'. The remaining content of that note will be used as system prompt.)`
            )
            .addTextArea((component) => {
                component.inputEl.rows = 6
                component.inputEl.style.width = '300px'
                component.inputEl.style.fontSize = '10px'
                component.setValue(this.plugin.settings.systemPrompt)
                component.onChange(async (value) => {
                    this.plugin.settings.systemPrompt = value
                    await this.plugin.saveSettings()
                })
            })

        new Setting(containerEl)
            .setName('Max input tokens')
            .setDesc(
                'The maximum number of tokens to send (within model limit). 0 means as many as possible'
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.maxInputTokens.toString())
                    .onChange(async (value) => {
                        const parsed = parseInt(value)
                        if (!isNaN(parsed)) {
                            this.plugin.settings.maxInputTokens = parsed
                            await this.plugin.saveSettings()
                        }
                    })
            )

        new Setting(containerEl)
            .setName('Max response tokens')
            .setDesc(
                'The maximum number of tokens to return from the API. 0 means no limit. (A token is about 4 characters).'
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.maxResponseTokens.toString())
                    .onChange(async (value) => {
                        const parsed = parseInt(value)
                        if (!isNaN(parsed)) {
                            this.plugin.settings.maxResponseTokens = parsed
                            await this.plugin.saveSettings()
                        }
                    })
            )

        new Setting(containerEl)
            .setName('Max depth')
            .setDesc(
                'The maximum depth of ancestor notes to include. 0 means no limit.'
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.maxDepth.toString())
                    .onChange(async (value) => {
                        const parsed = parseInt(value)
                        if (!isNaN(parsed)) {
                            this.plugin.settings.maxDepth = parsed
                            await this.plugin.saveSettings()
                        }
                    })
            )

        new Setting(containerEl)
            .setName('Temperature')
            .setDesc('Sampling temperature (0-2). 0 means no randomness.')
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.temperature.toString())
                    .onChange(async (value) => {
                        const parsed = parseFloat(value)
                        if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
                            this.plugin.settings.temperature = parsed
                            await this.plugin.saveSettings()
                        }
                    })
            )


        new Setting(containerEl)
            .setName('Debug output')
            .setDesc('Enable debug output in the console')
            .addToggle((component) => {
                component
                    .setValue(this.plugin.settings.debug)
                    .onChange(async (value) => {
                        this.plugin.settings.debug = value
                        await this.plugin.saveSettings()
                    })
            })
    }
}

