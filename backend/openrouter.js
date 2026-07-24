const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * 3-strategy JSON parser for AI responses.
 */
function parseAIJson(text) {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (e) {}
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }
  return null;
}

async function queryAI(prompt, context = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

  if (!apiKey || apiKey === 'your_openrouter_key_here') {
    throw new Error('OpenRouter API key not configured');
  }

  try {
    const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Crop Disease & Pest Detection'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert agronomist and plant pathologist with deep knowledge of crop diseases, pest management, and sustainable agriculture practices. Provide detailed, practical, and actionable advice. Format your responses clearly with sections and bullet points where appropriate. Be specific with product names, dosages, and timing when relevant.'
          },
          {
            role: 'user',
            content: context ? `Context: ${context}\n\nQuestion: ${prompt}` : prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) throw new Error(data.error?.message || `OpenRouter request failed with ${response.status}`);
    if (!data.choices?.[0]?.message?.content) throw new Error('OpenRouter returned no content');

    const content = data.choices?.[0]?.message?.content || 'No response generated';
    const parsed = parseAIJson(content);
    return {
      response: content,
      parsed,
      model: data.model || model,
      usage: data.usage || null,
      id: data.id || null
    };
  } catch (error) {
    throw error;
  }
}

module.exports = { queryAI, parseAIJson };
