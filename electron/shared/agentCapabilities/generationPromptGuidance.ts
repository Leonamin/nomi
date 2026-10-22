/** Generation encoder input is distinct from the creator-facing document and labels. */
export const GENERATION_PROMPT_LANGUAGE_GUIDELINE = 'Use English for model-facing generation prompts unless the selected profile declares another language. Preserve the original source document, titles, names, captions and dialogue in the user’s language. Translate subject, action, lighting, camera and style faithfully; add no subjects and keep quoted on-screen text unchanged. Explain adaptation in the user’s language; show the actual generation prompt before approval. Never silently rewrite saved prompts.'

/**
 * Spoken-line register (honorific level / speech style) must not drift between shots. This asks only for
 * visibility and consistency, never for a particular register: choosing it is the creator's call.
 */
export const SPOKEN_REGISTER_GUIDELINE = 'When you write spoken lines (dialogue or narration), decide each speaker\'s speech register first, show it in one line in the document or draft, and keep it consistent across shots. The user\'s instructions and the brief\'s settings take precedence; note the change on the same line if a speaker\'s register shifts on purpose.'
