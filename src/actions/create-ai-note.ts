import { TiktokenModel, encodingForModel } from 'js-tiktoken'
import { App, ItemView, Notice } from 'obsidian'
import { CanvasNode } from '@/obsidian/canvas-internal'
import { CanvasView, calcHeight, createEmptyNode, createNode } from '@/obsidian/canvas-patches'
import { visitNodeAndAncestors } from '@/obsidian/canvasUtil'
import { readNodeContent } from '@/obsidian/fileUtil'
import { OPENAI_MODELS, getOpenAIModelByName, streamOpenAICompletion } from '@/ai-providers/openai'
import { PluginSettings, DEFAULT_SETTINGS } from '@/settings'
import { ChatCompletionMessageParam } from 'openai/resources'

import { streamSearchCompletion } from '@/ai-providers/perplexity'
import { openai } from '@/types/openai-types'
import { Logger } from '@/util/logging'


const NOTE_LOADING_HEIGHT = 60
// const NOTE_USER_MIN_HEIGHT = 100
const NOTE_ASSISTANT_MIN_HEIGHT = 400
const NOTE_ASSISTANT_INCR_HEIGHT_STEP = 150
const NOTE_ASSISTANT_COLOR = '6'
const NOTE_ASSISTANT_SEARCH_COLOR = '5'

export function AINote(app: App, settings: PluginSettings, logDebug: Logger) {
	const isOpenAISet = () => {
		if (!settings.openAIApiKey) {
			new Notice('Please set your OpenAI API key in the plugin settings')
			return false
		}
		return true
	}

	// const isTavilySet = () => {
	// 	if (!settings.tavilyApiKey) {
	// 		new Notice('Please set your Tavily API key in the plugin settings')
	// 		return false
	// 	}
	// 	return true
	// }

	const isSystemPromptNode = (text: string) => text.trim().startsWith('SYSTEM PROMPT')


	const nextNote = async () => {
		logDebug('Creating user note')

		const canvas = getActiveCanvas()
		if (!canvas) {
			logDebug('No active canvas')
			return
		}

		await canvas.requestFrame()

		const selection = canvas.selection
		if (selection?.size !== 1) return
		const values = Array.from(selection.values()) as CanvasNode[]
		const node = values[0]

		if (node) {
			const created = createEmptyNode(canvas, node, {
				text: '',
				size: { height: 100 }
			})
			canvas.selectOnly(created, true /* startEditing */)

			// startEditing() doesn't work if called immediately
			await canvas.requestSave()
			await sleep(100)

			created.startEditing()
		}
	}

	const getActiveCanvas = () => {
		const maybeCanvasView = app.workspace.getActiveViewOfType(
			ItemView
		) as CanvasView | null
		return maybeCanvasView ? maybeCanvasView['canvas'] : null
	}

	const getSystemPrompt = async (node: CanvasNode) => {
		let foundPrompt: string | null = null

		await visitNodeAndAncestors(node, async (n: CanvasNode) => {
			const text = await readNodeContent(n)
			if (text && isSystemPromptNode(text)) {
				foundPrompt = text
				return false
			} else {
				return true
			}
		})

		return foundPrompt || settings.systemPrompt
	}

	const buildMessages = async (node: CanvasNode) => {
		const encoding = encodingForModel(
			(settings.openAIApiModel || DEFAULT_SETTINGS.openAIApiModel) as TiktokenModel
		)

		// const messages: openai.ChatCompletionRequestMessage[] = []
		const messages: ChatCompletionMessageParam[] = []

		let tokenCount = 0

		// Note: We are not checking for system prompt longer than context window.
		// That scenario makes no sense, though.
		const systemPrompt = await getSystemPrompt(node)
		if (systemPrompt) {
			tokenCount += encoding.encode(systemPrompt).length
		}

		const visit = async (node: CanvasNode, depth: number) => {
			if (settings.maxDepth && depth > settings.maxDepth) return false

			const nodeData = node.getData()
			let nodeText = (await readNodeContent(node))?.trim() || ''
			const inputLimit = getTokenLimit(settings)

			let shouldContinue = true
			if (!nodeText) {
				return shouldContinue
			}

			if (nodeText.startsWith('data:image')) {
				messages.unshift({
					content: [{
						'type': 'image_url',
						'image_url': { 'url': nodeText }
					}],
					role: 'user'
				})
			} else {
				if (isSystemPromptNode(nodeText)) return true

				const nodeTokens = encoding.encode(nodeText)
				let keptNodeTokens: number

				if (tokenCount + nodeTokens.length > inputLimit) {
					// will exceed input limit
					shouldContinue = false

					// Leaving one token margin, just in case
					const keepTokens = nodeTokens.slice(0, inputLimit - tokenCount - 1)
					const truncateTextTo = encoding.decode(keepTokens).length
					logDebug(`Truncating node text from ${nodeText.length} to ${truncateTextTo} characters`)
					nodeText = nodeText.slice(0, truncateTextTo)
					keptNodeTokens = keepTokens.length
				} else {
					keptNodeTokens = nodeTokens.length
				}

				tokenCount += keptNodeTokens

				const role: openai.ChatCompletionRequestMessageRoleEnum =
					nodeData.chat_role === 'assistant' ? 'assistant' : 'user'

				messages.unshift({
					content: nodeText,
					role
				})
			}

			return shouldContinue
		}

		await visitNodeAndAncestors(node, visit)

		if (messages.length) {
			if (systemPrompt) {
				messages.unshift({
					content: systemPrompt,
					role: 'system'
				})
			}

			return { messages, tokenCount }
		} else {
			return { messages: [], tokenCount: 0 }
		}
	}

	const generateNote = async () => {
		if (!isOpenAISet()) return

		logDebug('Creating AI note')

		const canvas = getActiveCanvas()
		if (!canvas) {
			logDebug('No active canvas')
			return
		}

		await canvas.requestFrame()

		const selection = canvas.selection
		if (selection?.size !== 1) return
		const values = Array.from(selection.values())
		const node = values[0]

		if (node) {
			// Last typed characters might not be applied to note yet
			await canvas.requestSave()
			await sleep(200)

			const { messages, tokenCount } = await buildMessages(node)
			if (!messages.length) return

			const created = createNode(
				canvas,
				node,
				{
					text: `\`\`\`Calling AI (${settings.openAIApiModel})...\`\`\``,
					size: { height: NOTE_LOADING_HEIGHT }
				},
				{
					color: NOTE_ASSISTANT_COLOR,
					chat_role: 'assistant'
				}
			)

			new Notice(
				`Sending ${messages.length} notes with ${tokenCount} tokens to GPT`
			)

			try {
				logDebug('messages', messages)

				let isDeltaZero = true
				// await streamOpenAICompletion(
				await streamOpenAICompletion(
					settings.openAIApiKey,
					settings.openAIApiUrl,
					settings.openAIApiModel,
					messages,
					{ max_tokens: settings.maxResponseTokens || undefined, temperature: settings.temperature },

					(delta?: string | null) => {
						if (!delta) return
						let newContent = ""
						if (isDeltaZero) {
							newContent = delta
							isDeltaZero = false

							created.moveAndResize({
								height: NOTE_ASSISTANT_MIN_HEIGHT,
								width: created.width,
								x: created.x,
								y: created.y,
							})

						} else {
							const height = calcHeight({ text: created.text })
							if (height > created.height) {
								created.moveAndResize({
									height:
										created.height + NOTE_ASSISTANT_INCR_HEIGHT_STEP,
									width: created.width,
									x: created.x,
									y: created.y,
								})
							}
							newContent = created.text + delta
						}
						created.setText(newContent)
					}
				)



				// const generated = await getOpenAICompletion(
				// settings.openAIApiKey,
				// settings.openAIApiUrl,
				// settings.openAIApiModel,
				// 	messages,
				// 	{
				// 		max_tokens: settings.maxResponseTokens || undefined,
				// 		temperature: settings.temperature
				// 	}
				// )

				// if (generated == null) {
				// 	new Notice(`Empty or unreadable response from GPT`)
				// 	canvas.removeNode(created)
				// 	return
				// }

				// created.setText(generated)
				// const height = calcHeight({
				// 	text: generated,
				// 	parentHeight: node.height
				// })
				// created.moveAndResize({
				// 	height,
				// 	width: created.width,
				// 	x: created.x,
				// 	y: created.y
				// })

				// const selectedNoteId =
				// 	canvas.selection?.size === 1
				// 		? Array.from(canvas.selection.values())?.[0]?.id
				// 		: undefined

				// if (selectedNoteId === node?.id || selectedNoteId == null) {
				// 	// If the user has not changed selection, select the created node
				// 	canvas.selectOnly(created, false /* startEditing */)
				// }
			} catch (error) {
				new Notice(`Error calling GPT: ${error.message || error}`)
				canvas.removeNode(created)
			}

			await canvas.requestSave()
		}
	}

	const generateSearchNote = async () => {
		if (!isOpenAISet()) return
		logDebug('Creating AI note')

		const canvas = getActiveCanvas()
		if (!canvas) {
			logDebug('No active canvas')
			return
		}

		await canvas.requestFrame()

		const selection = canvas.selection
		if (selection?.size !== 1) return
		const values = Array.from(selection.values())
		const node = values[0]

		if (node) {
			// Last typed characters might not be applied to note yet
			await canvas.requestSave()
			await sleep(200)

			const { messages, tokenCount } = await buildMessages(node)
			if (!messages.length) return

			const created = createNode(
				canvas,
				node,
				{
					text: `\`\`\`Calling AI Search with (${settings.openAIApiModel})...\`\`\``,
					size: { height: NOTE_LOADING_HEIGHT }
				},
				{
					color: NOTE_ASSISTANT_SEARCH_COLOR,
					chat_role: 'assistant'
				}
			)

			new Notice(`Sending ${messages.length} notes with ${tokenCount} tokens to GPT`)

			try {
				logDebug('messages', messages)

				let isDeltaZero = true
				// await streamOpenAICompletion(
				await streamSearchCompletion(
					settings.openAIApiKey,
					settings.openAIApiUrl,
					settings.openAIApiModel,
					messages,
					{ max_tokens: settings.maxResponseTokens || undefined, temperature: settings.temperature },

					(delta?: string | null) => {
						if (!delta) return
						let newContent = ""
						if (isDeltaZero) {
							newContent = delta
							isDeltaZero = false

							created.moveAndResize({
								height: NOTE_ASSISTANT_MIN_HEIGHT,
								width: created.width,
								x: created.x,
								y: created.y,
							})

						} else {
							const height = calcHeight({ text: created.text })
							if (height > created.height) {
								created.moveAndResize({
									height:
										created.height + NOTE_ASSISTANT_INCR_HEIGHT_STEP,
									width: created.width,
									x: created.x,
									y: created.y,
								})
							}
							newContent = created.text + delta
						}
						created.setText(newContent)
					}
				)

			} catch (error) {
				new Notice(`Error calling GPT: ${error.message || error}`)
				canvas.removeNode(created)
			}

			await canvas.requestSave()
		}
	}



	return { nextNote, generateSearchNote, generateNote }
}

function getTokenLimit(settings: PluginSettings) {
	const model = getOpenAIModelByName(settings.openAIApiModel) || OPENAI_MODELS.GPT_35_TURBO_0125
	return settings.maxInputTokens
		? Math.min(settings.maxInputTokens, model.tokenLimit)
		: model.tokenLimit
}
