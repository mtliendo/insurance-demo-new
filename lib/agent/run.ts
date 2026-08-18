import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT, claimContext } from '@/lib/agent/system-prompt'
import { runTool, tools } from '@/lib/agent/tools'
import { getClaim } from '@/lib/claims'
import type { ChatMessage, Claim } from '@/lib/types'

const anthropic = new Anthropic()

const MODEL = 'claude-opus-5'
const MAX_TOKENS = 8000
const MAX_TURNS = 6

/**
 * One agent turn. Replaces the Strands Agent + Bedrock nova-lite Lambda.
 *
 * The tool loop is written out rather than delegated to the SDK tool runner so
 * the read-claim-fresh-after-each-tool step is visible: tools write to Neon, so
 * the claim is re-read between iterations and the caller gets the post-tool row.
 */
export async function runAgent(
  claim: Claim,
  history: ChatMessage[],
): Promise<{ reply: string; claim: Claim }> {
  // The API requires the first message to be from the user, and our stored
  // history opens with the assistant's greeting.
  const firstUser = history.findIndex((m) => m.role === 'user')
  const trimmed = firstUser >= 0 ? history.slice(firstUser) : []

  const messages: Anthropic.MessageParam[] = trimmed.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  let current = claim

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT + '\n\n' + claimContext(current),
      output_config: { effort: 'low' },
      tools,
      messages,
    })

    if (response.stop_reason === 'refusal') {
      return {
        reply:
          'Sorry, I am not able to help with that. Could you describe the incident itself?',
        claim: current,
      }
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()

      return {
        reply: text || 'I apologize, but I could not generate a response.',
        claim: current,
      }
    }

    // Echo the assistant turn back verbatim so thinking and tool_use blocks survive.
    messages.push({ role: 'assistant', content: response.content })

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const call of toolUses) {
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: await runTool(current, call.name, call.input as Record<string, unknown>),
      })
    }

    // Tools mutate the claim row; re-read so the next system prompt and the
    // returned snapshot reflect what actually landed in the database.
    current = (await getClaim(current.id)) ?? current

    messages.push({ role: 'user', content: results })
  }

  return {
    reply:
      "Sorry, I'm having trouble wrapping that up. Could you tell me a bit more about the incident?",
    claim: current,
  }
}
