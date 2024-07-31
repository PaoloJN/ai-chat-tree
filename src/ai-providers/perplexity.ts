// THIS DOES NOT USE PERPLEXITY, IT USES OPENAI AND TAVILY API

import OpenAI from "openai"

import { openai } from '@/types/openai-types'
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources'
// import { TavilyClient, assert } from '@agentic/stdlib'
// import Exa from 'exa-js'



const currentDate = new Date().toLocaleString()

const SYSTEM_PROMPT = `As a professional search expert, you possess the ability to search for any information on the web.
    or any information on the web.
    For each user query, utilize the search results to their fullest potential to provide additional information and assistance in your response.
    Aim to directly address the user's question, augmenting your response with insights gleaned from the search results.
    Whenever quoting or referencing information from a specific URL, always explicitly cite the source URL using the [number](url) format make sure leave and extra space before and after the citation. Multiple citations can be included as needed, e.g., [number](url), [number](url).
    The number must always match the order of the search results And USE ALL SEARCH RESULTS.
    The retrieve tool can only be used with URLs provided by the user. URLs from search results cannot be used.
    If it is a domain instead of a URL, specify it in the include_domains of the search tool.
    Please match the language of the response to the user's language. Current date and time: ${currentDate}
    `

const tools: Array<ChatCompletionTool> = [
    {
        type: "function",
        function: {
            name: "search",
            description: "Search the web for information",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The query to search for"
                    },
                    max_results: {
                        type: "number",
                        description: "The maximum number of results to return"
                    },
                    search_depth: {
                        type: "string",
                        enum: ["basic", "advanced"],
                        description: "The depth of the search"
                    },
                    include_domains: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "A list of domains to specifically include in the search results. Default is None, which includes all domains."
                    },
                    exclude_domains: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "A list of domains to specifically exclude from the search results. Default is None, which doesn't exclude any domains."
                    }
                },
                required: ["query"],
            },
        }
    }
]



export async function streamSearchCompletion(
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
        dangerouslyAllowBrowser: true,
    })

    // add system prompt to the beginning of the messages
    messages.unshift({
        role: 'system',
        content: SYSTEM_PROMPT
    })

    console.debug("Tools", { tools })

    // call one to invoke the function
    const res = await openai.chat.completions.create({
        messages,
        model: model,
        temperature: 0,
        tools: tools,
        tool_choice: 'required',
    })
    const message = res.choices[0].message
    console.debug("AI response", { message })

    // Check if model wants to call tool
    const toolCalls = message.tool_calls
    if (toolCalls) {
        const availableFunctions = {
            search: tavilySearch
        }
        messages.push(message)
        // @ts-ignore
        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name
            console.debug("Function name", { functionName })
            // @ts-ignore
            const functionToCall = availableFunctions[functionName]

            const functionArgs = JSON.parse(toolCall.function.arguments)
            const functionResponse = await functionToCall(
                functionArgs.query,
                functionArgs.max_results,
                functionArgs.search_depth,
                functionArgs.include_domains,
                functionArgs.exclude_domains
            )
            messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: JSON.stringify(functionResponse)
            })


        }
    }



    console.debug("Messages")
    console.debug(JSON.stringify(messages))

    const stream = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
    })

    for await (const chunk of stream) {
        // console.debug("AI chunk", { chunk })
        callback(chunk.choices[0]?.delta?.content || "")
    }
    callback(null)
}





async function tavilySearch(
    query: string,
    maxResults = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
): Promise<any> {
    const apiKey = "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"
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults < 5 ? 5 : maxResults,
            search_depth: searchDepth,
            include_images: true,
            include_answers: true,
            include_domains: includeDomains,
            exclude_domains: excludeDomains
        })
    })

    if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
    }

    const data = await response.json()
    return data
}

// async function exaSearch(
//     query: string,
//     maxResults = 10,
//     includeDomains: string[] = [],
//     excludeDomains: string[] = []
// ): Promise<any> {
//     const apiKey = process.env.EXA_API_KEY
//     const exa = new Exa(apiKey)
//     return exa.searchAndContents(query, {
//         highlights: true,
//         numResults: maxResults,
//         includeDomains,
//         excludeDomains
//     })
// }
