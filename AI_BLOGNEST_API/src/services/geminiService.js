const { GoogleGenAI } = require('@google/genai');

// ─── Initialize Gemini client ─────────────────────────────────────────────────

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }
  return new GoogleGenAI({ apiKey });
};

const getModelName = () => {
  const model = process.env.GEMINI_MODEL;
  if (!model) {
    throw new Error('GEMINI_MODEL environment variable is not set.');
  }
  return model;
};

// ─── Helper: Parse JSON from Gemini response text ────────────────────────────

/**
 * Attempts to extract and parse a JSON object from a Gemini text response.
 * Handles responses wrapped in markdown code fences.
 *
 * @param {string} text - Raw text from Gemini.
 * @returns {object} Parsed JSON object.
 * @throws Will throw if JSON cannot be parsed.
 */
const parseJsonFromResponse = (text) => {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  // Find the first { and last } to isolate JSON
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in Gemini response.');
  }
  const jsonString = cleaned.substring(start, end + 1);
  return JSON.parse(jsonString);
};

// ─── Ambiguity Detection ──────────────────────────────────────────────────────

/**
 * Determines whether the provided context is sufficient to resolve ambiguity.
 * Uses Gemini to evaluate the request before generating content.
 *
 * @param {object} params
 * @param {string} params.topic
 * @param {string} params.category
 * @param {string[]} params.keywords
 * @param {string} [params.description]
 * @returns {Promise<{ isAmbiguous: boolean, reason: string }>}
 */
const checkAmbiguity = async ({ topic, category, keywords, description }) => {
  const ai = getClient();
  const modelName = getModelName();

  const keywordList =
    keywords && keywords.length > 0 ? keywords.join(', ') : 'none provided';
  const desc = description || 'none provided';

  const prompt = `
You are an expert content analyst. Your job is to determine whether the following blog generation request contains enough context to understand the EXACT intended subject matter WITHOUT any ambiguity.

REQUEST:
- Topic: "${topic}"
- Category: "${category}"
- Keywords: ${keywordList}
- Additional Description: ${desc}

INSTRUCTIONS:
1. Analyze the topic, category, and keywords together.
2. Determine if there is a single, clear, unambiguous subject intended.
3. The category and keywords are the primary disambiguators — use them.
4. If the combined context (topic + category + keywords) clearly identifies one specific subject, it is NOT ambiguous.
5. It is only genuinely ambiguous if the context contains contradictory signals or truly insufficient information to distinguish between completely different subjects.

Respond ONLY with a JSON object in this exact format:
{
  "isAmbiguous": true or false,
  "intendedSubject": "brief description of the identified subject (or 'unclear' if ambiguous)",
  "reason": "brief explanation of your decision"
}
`.trim();

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    const text = response.text;
    const result = parseJsonFromResponse(text);
    return {
      isAmbiguous: result.isAmbiguous === true,
      intendedSubject: result.intendedSubject || '',
      reason: result.reason || '',
    };
  } catch (err) {
    // If ambiguity check itself fails, log and assume not ambiguous
    // to let the main generation attempt proceed
    console.warn('⚠️  Ambiguity check failed, proceeding with generation:', err.message);
    return { isAmbiguous: false, intendedSubject: '', reason: '' };
  }
};

// ─── Blog Generation ──────────────────────────────────────────────────────────

/**
 * Generate a complete blog article using Gemini AI.
 *
 * @param {object} params
 * @param {string} params.topic - The blog topic.
 * @param {string} params.category - The content category (e.g., Technology, History).
 * @param {string[]} params.keywords - Relevant keywords.
 * @param {string} [params.description] - Optional extra context from the user.
 * @param {string} [params.audience] - Optional intended audience.
 * @param {string} [params.length] - Optional desired length (short/medium/long).
 * @returns {Promise<{ title, summary, content, category, tags }>}
 */
const generateBlog = async ({
  topic,
  category,
  keywords,
  description,
  audience,
  length,
}) => {
  const ai = getClient();
  const modelName = getModelName();

  const keywordList =
    keywords && keywords.length > 0 ? keywords.join(', ') : 'none provided';
  const audienceInfo = audience ? `Intended audience: ${audience}.` : '';
  const lengthInfo = length
    ? `Desired length: ${length} (short ≈ 400 words, medium ≈ 800 words, long ≈ 1500+ words).`
    : 'Desired length: medium (approximately 800 words).';
  const descInfo = description ? `Additional context: ${description}.` : '';

  const prompt = `
You are an expert blog writer. Generate a complete, high-quality, informative blog article based on the following request.

REQUEST DETAILS:
- Topic: "${topic}"
- Category: "${category}"
- Keywords: ${keywordList}
${descInfo}
${audienceInfo}
${lengthInfo}

CRITICAL INSTRUCTIONS:
1. Use the category and keywords as the PRIMARY guide to determine the EXACT meaning of the topic.
   Example: If the topic is "Java" but the category is "Programming" and keywords include "JVM", write about the Java programming language.
   Example: If the topic is "Java" but the category is "Travel" and keywords include "Indonesia", write about the Java island.
   Example: If the topic is "Apple" and the category is "Technology" and keywords include "iPhone", write about Apple Inc.
   Example: If the topic is "Apple" and the category is "Health" and keywords include "fruit", write about the apple fruit.
2. The ENTIRE article — title, summary, content, examples, and conclusion — must be about the SAME intended subject. Do NOT mix subjects.
3. Adapt the article structure to the category/subject domain:
   - Programming/Technology: technical explanations, architecture, code concepts, use cases.
   - History: timeline, causes, events, consequences, historical significance.
   - Science: concepts, evidence, mechanisms, applications.
   - Business/Finance: concepts, examples, market implications.
   - Travel/Geography: destination info, culture, geography, practical tips.
   - Food/Health: ingredients, benefits, preparation, nutritional context.
   - Sports: rules, history, athletes, techniques.
   - General/Other: appropriate structure for the subject domain.
4. Do NOT force a programming-style structure onto non-programming topics.
5. Include relevant real-world examples appropriate for the subject.
6. Write original, coherent content — do not copy or hallucinate fake statistics.
7. Keep the content relevant to all provided keywords.

OUTPUT FORMAT — respond ONLY with this exact JSON structure (no markdown fences, no extra text):
{
  "title": "A compelling, specific title for the article",
  "summary": "A concise 2-3 sentence summary of the article",
  "content": "The full article content (paragraphs separated by double newlines)",
  "category": "${category}",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

The tags array must contain 3-7 relevant tags derived from the topic, category, and keywords.
`.trim();

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  const rawText = response.text;

  let parsed;
  try {
    parsed = parseJsonFromResponse(rawText);
  } catch (parseErr) {
    console.error('❌ Failed to parse Gemini blog generation response:', parseErr.message);
    console.error('Raw Gemini response:', rawText);
    throw new Error('AI returned malformed content. Please try again.');
  }

  // Validate required fields
  const required = ['title', 'summary', 'content', 'category', 'tags'];
  const missing = required.filter(
    (f) => !parsed[f] || (Array.isArray(parsed[f]) && parsed[f].length === 0)
  );
  if (missing.length > 0) {
    console.error('❌ Gemini response missing fields:', missing, parsed);
    throw new Error(
      `AI response is incomplete. Missing fields: ${missing.join(', ')}.`
    );
  }

  // Ensure tags is an array
  if (!Array.isArray(parsed.tags)) {
    parsed.tags = String(parsed.tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return {
    title: String(parsed.title).trim(),
    summary: String(parsed.summary).trim(),
    content: String(parsed.content).trim(),
    category: String(parsed.category || category).trim(),
    tags: parsed.tags,
  };
};

// ─── Blog Summarization ───────────────────────────────────────────────────────

/**
 * Summarize existing blog content using Gemini AI.
 *
 * @param {string} content - The blog content to summarize.
 * @returns {Promise<string>} The generated summary.
 */
const summarizeBlog = async (content) => {
  const ai = getClient();
  const modelName = getModelName();

  const prompt = `
You are an expert content summarizer. Your task is to create a concise, accurate summary of the following article.

INSTRUCTIONS:
1. Read the article carefully and identify the EXACT subject being discussed.
2. Summarize THAT specific subject — do not reinterpret or switch to a different meaning.
3. Preserve all key concepts, main points, and important conclusions.
4. Do not introduce any facts, claims, or information that are not present in the original article.
5. Do not change the meaning or subject of the article.
6. Keep the summary concise: approximately 2-4 informative sentences. Adjust slightly if the article requires it.
7. Write in clear, professional language.

ARTICLE CONTENT:
"""
${content}
"""

Respond ONLY with a JSON object in this exact format:
{
  "summary": "Your concise summary here"
}
`.trim();

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  const rawText = response.text;

  let parsed;
  try {
    parsed = parseJsonFromResponse(rawText);
  } catch (parseErr) {
    console.error('❌ Failed to parse Gemini summarization response:', parseErr.message);
    console.error('Raw Gemini response:', rawText);
    throw new Error('AI returned malformed summary. Please try again.');
  }

  if (!parsed.summary || typeof parsed.summary !== 'string') {
    throw new Error('AI summary response is missing the summary field.');
  }

  return parsed.summary.trim();
};

module.exports = {
  generateBlog,
  summarizeBlog,
  checkAmbiguity,
};
