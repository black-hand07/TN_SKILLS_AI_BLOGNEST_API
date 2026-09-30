const { validationResult } = require('express-validator');
const geminiService = require('../services/geminiService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatted,
    });
    return true;
  }
  return false;
};

// ─── Generate Blog ────────────────────────────────────────────────────────────

/**
 * POST /api/ai/generate-blog
 * Generate a complete blog article using Gemini AI.
 *
 * Body:
 *   topic       {string}   required
 *   category    {string}   required
 *   keywords    {string[]} required (1-10 items)
 *   description {string}   optional — extra context for disambiguation
 *   audience    {string}   optional — intended audience
 *   length      {string}   optional — 'short' | 'medium' | 'long'
 */
const generateBlog = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { topic, category, keywords, description, audience, length } = req.body;

    // ── Step 1: Ambiguity check ───────────────────────────────────────────────
    const ambiguityResult = await geminiService.checkAmbiguity({
      topic,
      category,
      keywords,
      description,
    });

    if (ambiguityResult.isAmbiguous) {
      return res.status(400).json({
        success: false,
        message:
          'The topic is ambiguous. Please provide a category, description, or keywords to clarify the intended subject.',
        data: {
          reason: ambiguityResult.reason,
          hint: 'Add more specific keywords or a description field to help identify the correct subject.',
        },
      });
    }

    // ── Step 2: Generate blog content ─────────────────────────────────────────
    const generated = await geminiService.generateBlog({
      topic,
      category,
      keywords,
      description,
      audience,
      length,
    });

    return res.status(200).json({
      success: true,
      message: 'Blog generated successfully.',
      data: generated,
    });
  } catch (error) {
    // Do NOT return 200 on failure — propagate to error middleware
    console.error('❌ AI Blog Generation Error:', error.message);

    // Attach a status code for the error middleware
    if (!error.statusCode) {
      error.statusCode = 502; // Bad Gateway — upstream AI service failure
    }
    error.message = error.message || 'AI content generation failed.';
    next(error);
  }
};

// ─── Summarize Blog ───────────────────────────────────────────────────────────

/**
 * POST /api/ai/summarize
 * Summarize a given blog content string using Gemini AI.
 *
 * Body:
 *   content {string} required — the text to summarize
 */
const summarizeBlog = async (req, res, next) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { content } = req.body;

    const summary = await geminiService.summarizeBlog(content);

    return res.status(200).json({
      success: true,
      message: 'Blog summarized successfully.',
      data: { summary },
    });
  } catch (error) {
    console.error('❌ AI Summarization Error:', error.message);

    if (!error.statusCode) {
      error.statusCode = 502;
    }
    error.message = error.message || 'AI summarization failed.';
    next(error);
  }
};

module.exports = { generateBlog, summarizeBlog };
