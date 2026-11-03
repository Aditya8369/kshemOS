import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ASR_PROVIDERS,
  REGIONAL_LANGUAGES,
  MULTILINGUAL_SAMPLES,
  detectCodeSwitching,
  InMemoryMultilingualASRManager,
} from './multilingualSpeechStore.js';

describe('MultilingualSpeechStore & Regional ASR Logic', () => {
  it('loads provider catalog with Indic language support and code-switching flags', () => {
    assert.ok(ASR_PROVIDERS.length >= 3);
    const bhashini = ASR_PROVIDERS.find((p) => p.id === 'bhashini');
    assert.ok(bhashini);
    assert.ok(bhashini.supportedLanguages.includes('hi'));
    assert.ok(bhashini.supportedLanguages.includes('ta'));
    assert.equal(bhashini.supportsCodeSwitching, true);

    const whisper = ASR_PROVIDERS.find((p) => p.id === 'whisper_local');
    assert.ok(whisper);
    assert.equal(whisper.isLocal, true);

    assert.ok(REGIONAL_LANGUAGES.length >= 8);
  });

  it('transcribes speech turn and flags low-confidence tokens below threshold with alternatives', () => {
    const manager = new InMemoryMultilingualASRManager();

    const turn = manager.transcribe({
      provider: 'bhashini',
      sampleId: 'sample-hi-digital-arrest',
      confidenceThreshold: 0.70,
    });

    assert.ok(turn.turn_id.startsWith('TURN-'));
    assert.equal(turn.speaker, 'caller');
    assert.ok(turn.original_text.includes('CVI Crime Branch'));
    assert.equal(turn.corrected_text, turn.original_text);
    assert.equal(turn.is_citizen_corrected, false);

    // Locate the low confidence word ("CVI" with 0.48 confidence)
    const lowConfWords = turn.words.filter((w) => w.is_low_confidence);
    assert.ok(lowConfWords.length >= 1);
    const targetWord = lowConfWords.find((w) => w.word === 'CVI');
    assert.ok(targetWord);
    assert.ok(targetWord.confidence < 0.70);
    assert.ok(targetWord.alternatives.includes('CBI'));
  });

  it('detects natural conversational code-switching between Indic languages and English', () => {
    const simulatedWords = [
      { word: 'Aapka', language: 'hi' },
      { word: 'parcel', language: 'en' },
      { word: 'customs', language: 'en' },
      { word: 'ne', language: 'hi' },
      { word: 'seize', language: 'en' },
      { word: 'kiya', language: 'hi' },
    ];

    const result = detectCodeSwitching(simulatedWords);
    assert.ok(result.segments.length >= 2, 'Should detect multiple language segments');
    const languages = new Set(result.segments.map((s) => s.language));
    assert.ok(languages.has('hi'));
    assert.ok(languages.has('en'));
  });

  it('applies citizen corrections to mistranscribed words without mutating original ASR text', () => {
    const manager = new InMemoryMultilingualASRManager();

    const turn = manager.transcribe({
      provider: 'bhashini',
      sampleId: 'sample-hi-digital-arrest',
      confidenceThreshold: 0.70,
    });

    const originalAsrSnapshot = turn.original_text;
    assert.ok(originalAsrSnapshot.includes('CVI'));

    // Citizen corrects token at index 2 ("CVI" -> "CBI")
    const updatedTurn = manager.applyCorrections(turn.turn_id, [
      {
        word_index: 2,
        original_word: 'CVI',
        corrected_word: 'CBI',
        corrected_by: 'citizen',
        timestamp: Date.now(),
      },
    ]);

    // IMMUTABILITY TEST: original_text MUST remain unmodified
    assert.equal(updatedTurn.original_text, originalAsrSnapshot);
    assert.ok(updatedTurn.original_text.includes('CVI'));

    // CORRECTED TEXT TEST: corrected_text contains the citizen edit
    assert.equal(updatedTurn.is_citizen_corrected, true);
    assert.ok(updatedTurn.corrected_text.includes('CBI'));
    assert.equal(updatedTurn.corrections.length, 1);
    assert.equal(updatedTurn.corrections[0].corrected_word, 'CBI');
  });

  it('passes corrected text to scam analysis while preserving raw ASR output for audit trails', () => {
    const manager = new InMemoryMultilingualASRManager();

    const rawAsr = 'Aap par digital arrest warrant issue hua hai turant safe account mein transfer kijiye';
    const corrected = 'Aap par digital arrest warrant issue hua hai turant safe account mein transfer kijiye';

    const result = manager.analyzeScam(corrected, rawAsr, 'hi', 'CBI Officer');

    assert.ok(result.risk_score >= 75.0, `Expected >= 75.0, got ${result.risk_score}`);
    assert.equal(result.risk_band, 'critical');
    assert.equal(result.analyzed_text, corrected);
    assert.equal(result.original_asr_text, rawAsr);
    assert.ok(result.recommendation.includes('1930'));
    assert.ok(result.matched_patterns.some((p) => p.includes('Arrest Threats')));
  });

  it('provides reliable manual text-entry fallback when audio/microphone is unavailable', () => {
    const manager = new InMemoryMultilingualASRManager();

    const fallbackText = 'Yeh customs vibhag hai aapka parcel seize kar liya hai turant shulk bhariye';
    const turn = manager.transcribe({
      provider: 'bhashini',
      textInput: fallbackText,
      targetLanguage: 'hi',
      speaker: 'caller',
    });

    assert.equal(turn.original_text, fallbackText);
    assert.equal(turn.corrected_text, fallbackText);
    assert.equal(turn.words.length, fallbackText.split(/\s+/).length);
    assert.equal(turn.speaker, 'caller');
    assert.equal(turn.is_citizen_corrected, false);
  });
});

