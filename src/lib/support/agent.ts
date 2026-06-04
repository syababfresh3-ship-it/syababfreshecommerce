import Anthropic from '@anthropic-ai/sdk'
import { buildSupportSystemPrompt } from './knowledge'
import { SUPPORT_TOOLS, runSupportTool, type SupportContext } from './tools'

interface ChatOptions {
  tools?: Anthropic.Tool[]
  system?: string
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-6'
const MAX_TOOL_ITERS = 6

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// Jalankan satu giliran chat: history + mesej baru → loop tool-use → teks balasan.
// Tool dikuatkuasa server-side (lihat tools.ts). System prompt di-cache.
export async function runSupportChat(
  ctx: SupportContext,
  history: ChatTurn[],
  userMessage: string,
  opts: ChatOptions = {},
): Promise<string> {
  const systemText = opts.system ?? buildSupportSystemPrompt()
  const tools = opts.tools ?? SUPPORT_TOOLS
  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < MAX_TOOL_ITERS; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      tools,
      messages,
    })

    messages.push({ role: 'assistant', content: resp.content })

    if (resp.stop_reason !== 'tool_use') {
      return resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim() || 'Maaf, saya tak dapat balas sekarang. Cuba lagi sebentar.'
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of resp.content) {
      if (block.type === 'tool_use') {
        const result = await runSupportTool(block.name, (block.input ?? {}) as Record<string, unknown>, ctx)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return 'Maaf, permintaan ini agak rumit. CS kami akan bantu — sila cuba terangkan ringkas, atau tunggu CS susuli.'
}
