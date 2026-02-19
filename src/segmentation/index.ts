export { segment, segmentWithFallback, DEFAULT_SIGNAL_WEIGHTS, DOCUMENT_SIGNAL_WEIGHTS } from './segmenter';
export type { OllamaSettings } from './segmenter';
export { OllamaClient } from './ollama/client';
export { scoreBoundaries } from './scorer';
export { generateTitle } from './title-generator';
export { generateTags } from './tag-generator';
export { mergeSegments, splitSegment, renameSegment } from './segment-utils';

export { scoreTransitionPhrases } from './signals/transition-phrases';
export { scoreDomainShift } from './signals/domain-shift';
export { scoreVocabularyShift } from './signals/vocabulary-shift';
export { scoreTemporalGap } from './signals/temporal-gap';
export { scoreSelfContained } from './signals/self-contained';
export { scoreReintroduction } from './signals/reintroduction';
