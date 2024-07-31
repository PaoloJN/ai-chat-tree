// import { request, RequestUrlParam } from 'obsidian'
import { openai } from '@/types/openai-types'
import OpenAI from "openai"
import { ChatCompletionMessageParam } from 'openai/resources'



export const OPENAI_COMPLETIONS_URL = `https://api.openai.com/v1/chat/completions`
export const OPENAI_MODELS = {
	GPT_35_TURBO: {
		name: 'gpt-3.5-turbo',
		tokenLimit: 4096
	},
	GPT_35_TURBO_0125: {
		name: 'gpt-3.5-turbo-0125',
		tokenLimit: 16385
	},
	GPT_35_16K: {
		name: 'gpt-3.5-turbo-16k',
		tokenLimit: 16385
	},
	GPT_35_TURBO_1106: {
		name: 'gpt-3.5-turbo-1106',
		tokenLimit: 16385
	},
	GPT_4o: {
		name: 'gpt-4o',
		tokenLimit: 128000
	},
	GPT_4: {
		name: 'gpt-4',
		tokenLimit: 8192
	},
	GPT_4_TURBO_PREVIEW: {
		name: 'gpt-4-turbo-preview',
		tokenLimit: 128000
	},
	GPT_4_0125_PREVIEW: {
		name: 'gpt-4-0125-preview',
		tokenLimit: 128000
	},
	GPT_4_1106_PREVIEW: {
		name: 'gpt-4-1106-preview',
		tokenLimit: 128000
	},
	GPT_4_0613: {
		name: 'gpt-4-0613',
		tokenLimit: 8192
	},
	GPT_4_32K: {
		name: 'gpt-4-32k',
		tokenLimit: 32768
	},
	GPT_4_32K_0613: {
		name: 'gpt-4-32k-0613',
		tokenLimit: 32768
	}
} as const

export type OpenAIModel = keyof typeof OPENAI_MODELS
export type OpenAIModelType = keyof typeof OPENAI_MODELS

export function getOpenAIModelByName(name: string) {
	return Object.values(OPENAI_MODELS).find((model) => model.name === name)
}

export const defaultOpenAISettings: Partial<openai.CreateChatCompletionRequest> =
{
	model: OPENAI_MODELS.GPT_35_TURBO.name,
	max_tokens: 500,
	temperature: 0,
	top_p: 1.0,
	presence_penalty: 0,
	frequency_penalty: 0,
	stop: []
}
// https://github.com/MetaCorp/obsidian-augmented-canvas
// https://github.com/borolgs/enchanted-canvas/tree/master


export async function streamOpenAICompletion(
	openAIApiKey: string,
	openAIApiUrl: string,
	model: openai.CreateChatCompletionRequest['model'],
	messages: ChatCompletionMessageParam[],
	settings?: Partial<
		Omit<openai.CreateChatCompletionRequest, 'messages' | 'model'>
	>,
	// @ts-ignore
	callback: (response: string | null) => void
) {
	console.debug("Calling AI :", {
		messages,
		model,
		isJSON: false,
		...settings,
	})

	const openai = new OpenAI({
		apiKey: openAIApiKey,
		// baseURL: openAIApiUrl,
		dangerouslyAllowBrowser: true,
	})

	const stream = await openai.chat.completions.create({
		model,
		messages,
		stream: true,
	})

	for await (const chunk of stream) {
		console.debug("AI chunk", { chunk })
		callback(chunk.choices[0]?.delta?.content || "")
	}
	callback(null)
}

// export async function getOpenAICompletion(
// 	openAIApiKey: string,
// 	openAIApiUrl: string,
// 	model: openai.CreateChatCompletionRequest['model'],
// 	messages: openai.CreateChatCompletionRequest['messages'],
// 	settings?: Partial<
// 		Omit<openai.CreateChatCompletionRequest, 'messages' | 'model'>
// 	>
// ): Promise<string | undefined> {
// 	const headers = {
// 		Authorization: `Bearer ${openAIApiKey}`,
// 		'Content-Type': 'application/json'
// 	}
// 	const body: openai.CreateChatCompletionRequest = {
// 		messages,
// 		model,
// 		...settings
// 	}
// 	const requestParam: RequestUrlParam = {
// 		url: openAIApiUrl,
// 		method: 'POST',
// 		contentType: 'application/json',
// 		body: JSON.stringify(body),
// 		headers
// 	}
// 	console.debug('Calling openAI', requestParam)
// 	const res: openai.CreateChatCompletionResponse | undefined = await request(
// 		requestParam
// 	)
// 		.then((response) => {
// 			return JSON.parse(response)
// 		})
// 		.catch((err) => {
// 			console.error(err)
// 			if (err.code === 429) {
// 				console.error(
// 					'OpenAI API rate limit exceeded. If you have free account, your credits may have been consumed or expired.'
// 				)
// 			}
// 		})
// 	return res?.choices?.[0]?.message?.content
// }

