const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function queryAI(prompt, context = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

  if (!apiKey || apiKey === 'your_openrouter_key_here') {
    return {
      response: 'OpenRouter API key not configured. Please add your key to .env file.',
      model: model,
      usage: null
    };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            content: 'You are an expert agricultural scientist specializing in crop disease detection, pest management, soil science, and farm management. Provide detailed, practical, and actionable advice. Format your responses clearly with sections and bullet points where appropriate. Be specific with product names, dosages, and timing when relevant.'
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

    if (data.error) {
      return {
        response: `AI Error: ${data.error.message || 'Unknown error'}`,
        model: model,
        usage: null
      };
    }

    return {
      response: data.choices?.[0]?.message?.content || 'No response generated',
      model: data.model || model,
      usage: data.usage || null,
      id: data.id || null
    };
  } catch (error) {
    return {
      response: `AI service unavailable: ${error.message}`,
      model: model,
      usage: null
    };
  }
}

module.exports = { queryAI };
