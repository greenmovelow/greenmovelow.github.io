/*
 * Optional Claude-assisted review for the takeoff workbench.
 *
 * Runs entirely in the browser: the API key is kept in localStorage and sent
 * only to api.anthropic.com. This is a static site with no build step, so the
 * Messages API is called with fetch instead of the npm SDK. The browser-access
 * header below is the same one the official SDK sends when
 * `dangerouslyAllowBrowser` is set; without it the API rejects CORS requests.
 *
 * The rules engine (engine.js) always runs first. Claude is asked to review the
 * same documents and return a structured second opinion in the same shape, so
 * the UI can show both and the estimator can accept or reject line by line.
 */

export const DEFAULT_MODEL = 'claude-opus-5';
export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (default; best reasoning for scope splits)', inputPerM: 5, outputPerM: 25 },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (faster, lower cost)', inputPerM: 2, outputPerM: 10 },
];

const API_URL = 'https://api.anthropic.com/v1/messages';

export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'questions', 'takeoff', 'rfis', 'responsibility', 'conflicts'],
  properties: {
    summary: { type: 'string', description: 'Bid-ready summary in five to ten sentences: what is confirmed, what is qualified, what is excluded.' },
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['question', 'why', 'options'],
        properties: {
          question: { type: 'string' },
          why: { type: 'string', description: 'Which pricing decision depends on the answer.' },
          options: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    takeoff: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['item', 'tags', 'qty', 'unit', 'quoteBy', 'section', 'confidence', 'qualifications', 'evidence', 'electricalScope'],
        properties: {
          item: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          qty: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Null when the documents do not support a count.' },
          unit: { type: 'string' },
          quoteBy: { type: 'string', enum: ['distributor', 'mechanical', 'integrator', 'package', 'install', 'ambiguous'] },
          section: { type: 'string', description: 'Controlling specification section number, e.g. 26 29 23.' },
          confidence: { type: 'string', enum: ['Confirmed', 'Probable', 'Possible'] },
          qualifications: { type: 'array', items: { type: 'string' } },
          electricalScope: { type: 'string', description: 'What Division 26 still carries when another party furnishes the item.' },
          evidence: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['doc', 'page', 'quote'], properties: { doc: { type: 'string' }, page: { type: 'integer' }, quote: { type: 'string' } } },
          },
        },
      },
    },
    rfis: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['priority', 'topic', 'question', 'pricingBasis', 'risk', 'evidence'],
        properties: {
          priority: { type: 'string', enum: ['critical', 'qualify', 'coordinate', 'compliance'] },
          topic: { type: 'string' },
          question: { type: 'string', description: 'The question exactly as it should be sent to the engineer.' },
          pricingBasis: { type: 'string', description: 'What the bid carries if the RFI is not answered before bid.' },
          risk: { type: 'string' },
          evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['doc', 'page', 'quote'], properties: { doc: { type: 'string' }, page: { type: 'integer' }, quote: { type: 'string' } } } },
        },
      },
    },
    responsibility: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['item', 'furnishedBy', 'installedBy', 'powerWiredBy', 'controlWiredBy', 'programmedBy', 'startedBy', 'evidence', 'confidence'],
        properties: {
          item: { type: 'string' }, furnishedBy: { type: 'string' }, installedBy: { type: 'string' }, powerWiredBy: { type: 'string' }, controlWiredBy: { type: 'string' }, programmedBy: { type: 'string' }, startedBy: { type: 'string' },
          evidence: { type: 'string' }, confidence: { type: 'string', enum: ['Confirmed', 'Probable', 'Possible'] },
        },
      },
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['topic', 'valueA', 'sourceA', 'valueB', 'sourceB', 'recommendedBasis'],
        properties: { topic: { type: 'string' }, valueA: { type: 'string' }, sourceA: { type: 'string' }, valueB: { type: 'string' }, sourceB: { type: 'string' }, recommendedBasis: { type: 'string' } },
      },
    },
  },
};

export const SYSTEM_PROMPT = `You are a senior electrical estimator and wastewater/industrial electrical application engineer preparing a Division 26 bid takeoff from a project manual and drawings.

Working rules:
- Read the documents as an estimator, not a summarizer. Count what the schedules and one-line diagrams support. When a count is not supported, return null quantity and say what document would supply it.
- Assign every item to exactly one quote channel: distributor (Division 26 gear, drives, lighting), mechanical (Division 22/23/43/44/46 equipment packages and their integral controls), integrator (Division 40 control panels, PLC/HMI, SCADA, networks, instruments assigned to the integrator), package (cranes, gates, fire alarm, communications, lightning, generator dealer when not through the distributor), install (contractor-carried raceway, wire, grounding, pads), or ambiguous when the documents conflict or are silent.
- Never resolve a conflict silently. When drawings and specifications disagree (fault ratings, enclosure types, horsepower, voltage, who furnishes), preserve both values with their sources, recommend a pricing basis, and write an RFI.
- Separate equipment quote units from installation material. Housekeeping pads, fence grounding, conduit and wire are carried, not quoted as units.
- Every takeoff line and RFI must cite the document name and page it came from with a short verbatim quote.
- Distinguish American Iron and Steel (AIS) from Build America, Buy America (BABA). Do not convert one into the other.
- Size drives from motor nameplate current, never from horsepower alone; flag missing FLA.
- Prefer addenda over original documents, dedicated technical sections over combined sets, and specifications over drawing callouts unless the documents state a different order of precedence.
- Write RFI questions so they can be pasted into an email to the engineer without editing.
- Do not invent equipment that the documents do not mention. Do not pad the list.`;

/**
 * Estimate token count and cost for a request body's text.
 */
export function estimate(chars, modelId) {
  const m = MODELS.find((x) => x.id === modelId) || MODELS[0];
  const inputTokens = Math.round(chars / 3.6);
  const outputTokens = 12000;
  return { inputTokens, outputTokens, cost: (inputTokens / 1e6) * m.inputPerM + (outputTokens / 1e6) * m.outputPerM };
}

function buildUserContent({ project, pages, answers, rulesSummary }) {
  const parts = [];
  parts.push(`PROJECT: ${project.name || 'Untitled'}\nBID DUE: ${answers.bidDue || 'unknown'}\n`);
  parts.push('ESTIMATOR ANSWERS TO INTAKE QUESTIONS:\n' + Object.entries(answers).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join('; ') : v}`).join('\n'));
  parts.push('RULES-ENGINE FIRST PASS (verify, correct, and extend; do not simply repeat):\n' + rulesSummary);
  parts.push('DOCUMENT PAGES (each block is one page; cite by document name and page number):');
  for (const p of pages) parts.push(`<page doc="${p.doc}" n="${p.page}">\n${p.text}\n</page>`);
  parts.push('Produce the complete Division 26 takeoff, quote-channel assignments, responsibility matrix, conflicts, RFIs, and any clarifying questions the estimator must answer before pricing.');
  return parts.join('\n\n');
}

/**
 * Run the review. Streams the response so long outputs do not time out.
 * onProgress(text, outputChars) is called as text arrives.
 */
export async function runReview({ apiKey, model = DEFAULT_MODEL, project, pages, answers, rulesSummary, onProgress, signal }) {
  if (!apiKey) throw new Error('No API key set.');
  const body = {
    model,
    max_tokens: 32000,
    stream: true,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: RESULT_SCHEMA }, effort: 'high' },
    messages: [{ role: 'user', content: buildUserContent({ project, pages, answers, rulesSummary }) }],
  };
  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch { /* ignore */ }
    throw new Error(`API error ${res.status}${detail ? ': ' + detail : ''}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = null;
  let usage = {};
  let responseModel = model;
  const handle = (evt) => {
    if (!evt.data) return;
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    switch (msg.type) {
      case 'message_start': usage = { ...usage, ...(msg.message?.usage || {}) }; responseModel = msg.message?.model || model; break;
      case 'content_block_delta': if (msg.delta?.type === 'text_delta') { text += msg.delta.text; onProgress && onProgress(text, text.length); } break;
      case 'message_delta': stopReason = msg.delta?.stop_reason || stopReason; if (msg.usage) usage = { ...usage, ...msg.usage }; if (msg.delta?.stop_details) usage.stop_details = msg.delta.stop_details; break;
      case 'error': throw new Error(msg.error?.message || 'stream error');
      default: break;
    }
  };
  // Server-sent events: blocks separated by blank lines, each with event:/data: lines.
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const evt = { event: '', data: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) evt.event = line.slice(6).trim();
        else if (line.startsWith('data:')) evt.data += line.slice(5).trim();
      }
      handle(evt);
    }
  }
  if (stopReason === 'refusal') throw new Error('The model declined this request' + (usage.stop_details?.explanation ? ': ' + usage.stop_details.explanation : '.'));
  if (stopReason === 'max_tokens') throw new Error('Output hit the token limit before finishing. Reduce the page selection and run again.');
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { throw new Error('Could not parse the structured response: ' + e.message); }
  return { result: parsed, usage, model: responseModel, stopReason, rawChars: text.length };
}

/**
 * Convert the Claude result into the engine's item / RFI shapes so both can
 * be displayed together. Ids are prefixed so they never collide.
 */
export function adaptResult(claudeResult, startRfiNumber = 1) {
  const items = (claudeResult.takeoff || []).map((t, i) => ({
    id: `claude-item-${i + 1}`,
    family: 'claude',
    category: 'Claude review',
    item: t.item,
    tags: t.tags || [],
    qty: typeof t.qty === 'number' ? t.qty : null,
    qtyBasis: typeof t.qty === 'number' ? 'Claude count from cited pages' : 'Not supported by documents (Claude)',
    unit: t.unit || 'ea',
    bucket: t.quoteBy || 'ambiguous',
    channelNote: '',
    electricalScope: t.electricalScope || '',
    section: t.section || '',
    sectionTitle: '',
    sectionPresent: Boolean(t.section),
    confidence: t.confidence || 'Possible',
    qualifications: t.qualifications || [],
    rfis: [],
    evidence: (t.evidence || []).map((e) => ({ doc: e.doc, page: e.page, snippet: e.quote })),
    source: 'claude',
  }));
  let n = startRfiNumber;
  const rfis = (claudeResult.rfis || []).map((r) => ({
    id: `RFI-${String(n++).padStart(2, '0')}`,
    priority: r.priority || 'qualify',
    topic: r.topic,
    question: r.question,
    pricingBasis: r.pricingBasis,
    risk: r.risk,
    evidence: (r.evidence || []).map((e) => ({ doc: e.doc, page: e.page, snippet: e.quote })),
    source: 'claude',
  }));
  const responsibility = (claudeResult.responsibility || []).map((r) => ({ ...r, tags: '', evidence: r.evidence ? [{ doc: '', page: '', snippet: r.evidence }] : [], source: 'claude' }));
  const conflicts = (claudeResult.conflicts || []).map((c) => ({ topic: c.topic, values: [`${c.valueA} (${c.sourceA})`, `${c.valueB} (${c.sourceB})`], basis: c.recommendedBasis, rfi: '', source: 'claude' }));
  return { items, rfis, responsibility, conflicts, questions: claudeResult.questions || [], summary: claudeResult.summary || '' };
}
