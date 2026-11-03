import sys
from app.models import WordCorrection
from app.services import multilingual_asr


def test_provider_catalog_and_languages():
    providers = multilingual_asr.ASR_PROVIDERS
    provider_ids = [p.id for p in providers]
    assert "bhashini" in provider_ids
    assert "whisper_local" in provider_ids
    assert "mock_adapter" in provider_ids
    assert "browser_speech" in provider_ids

    bhashini = next(p for p in providers if p.id == "bhashini")
    assert "hi" in bhashini.supported_languages
    assert "ta" in bhashini.supported_languages
    assert bhashini.supports_code_switching is True


def test_transcription_with_word_confidence_and_low_confidence_flagging():
    # Transcribe sample with known low-confidence word
    turn = multilingual_asr.transcribe_speech(
        provider="bhashini",
        sample_id="sample-hi-digital-arrest",
        confidence_threshold=0.70,
    )

    assert turn.turn_id.startswith("TURN-")
    assert turn.original_text.startswith("Namaste main CVI Crime Branch")
    assert turn.corrected_text == turn.original_text
    assert turn.is_citizen_corrected is False
    assert len(turn.words) > 0

    # Locate low confidence token (e.g., CVI with ~0.48 confidence)
    low_conf_words = [w for w in turn.words if w.is_low_confidence]
    assert len(low_conf_words) >= 1
    low_word = low_conf_words[0]
    assert low_word.confidence < 0.70
    assert "CBI" in low_word.alternatives


def test_regional_code_switching_detection():
    turn = multilingual_asr.transcribe_speech(
        provider="mock_adapter",
        sample_id="sample-hi-digital-arrest",
        enable_code_switching=True,
    )

    assert turn.detected_language in ["hi", "en"]
    assert len(turn.code_switch_segments) >= 2
    languages_present = {seg.language for seg in turn.code_switch_segments}
    assert "hi" in languages_present
    assert "en" in languages_present


def test_citizen_correction_preserves_original_asr_output():
    turn = multilingual_asr.transcribe_speech(
        provider="bhashini",
        sample_id="sample-hi-digital-arrest",
        confidence_threshold=0.70,
    )

    original_raw = turn.original_text

    # Citizen corrects word index 2 ("CVI" -> "CBI")
    correction = WordCorrection(
        word_index=2,
        original_word="CVI",
        corrected_word="CBI",
        corrected_by="citizen",
        timestamp=1700000000000,
    )

    updated_turn = multilingual_asr.apply_citizen_corrections(
        turn_id=turn.turn_id,
        word_corrections=[correction],
    )

    # CRITICAL CHECK: original_text must NOT be overwritten!
    assert updated_turn.original_text == original_raw
    assert "CVI" in updated_turn.original_text

    # corrected_text should contain the user correction
    assert updated_turn.is_citizen_corrected is True
    assert "CBI" in updated_turn.corrected_text
    assert len(updated_turn.corrections) == 1
    assert updated_turn.corrections[0].corrected_word == "CBI"


def test_multilingual_scam_analysis_dual_tracking():
    # Original mistranscribed ASR text vs Citizen corrected text
    raw_asr = "Namaste main CVI se bol raha hoon aap par digital arrest warrant issue hua hai turant safe account mein transfer kijiye"
    corrected = "Namaste main CBI se bol raha hoon aap par digital arrest warrant issue hua hai turant safe account mein transfer kijiye"

    res = multilingual_asr.analyze_multilingual_scam(
        text_to_analyze=corrected,
        original_asr_text=raw_asr,
        language="hi",
        caller_claims_to_be="CBI Crime Branch",
    )

    assert res.risk_score >= 75.0
    assert res.risk_band == "critical"
    assert res.was_corrected is True
    assert res.analyzed_text == corrected
    assert res.original_asr_text == raw_asr
    assert "1930" in res.recommendation


def test_text_entry_fallback():
    # User types directly in text-entry fallback mode
    fallback_text = "Yeh customs vibhag hai aapka parcel seize kar liya hai shulk bhariye"
    turn = multilingual_asr.transcribe_speech(
        provider="bhashini",
        text_input=fallback_text,
        target_language="hi",
        speaker="caller",
    )

    assert turn.original_text == fallback_text
    assert turn.corrected_text == fallback_text
    assert len(turn.words) == len(fallback_text.split())
    assert turn.speaker == "caller"


def run_all_tests():
    print("Running backend Multilingual ASR tests...")
    test_provider_catalog_and_languages()
    print("test_provider_catalog_and_languages PASSED")
    test_transcription_with_word_confidence_and_low_confidence_flagging()
    print("test_transcription_with_word_confidence_and_low_confidence_flagging PASSED")
    test_regional_code_switching_detection()
    print("test_regional_code_switching_detection PASSED")
    test_citizen_correction_preserves_original_asr_output()
    print("test_citizen_correction_preserves_original_asr_output PASSED")
    test_multilingual_scam_analysis_dual_tracking()
    print("test_multilingual_scam_analysis_dual_tracking PASSED")
    test_text_entry_fallback()
    print("test_text_entry_fallback PASSED")
    print("ALL 6 MULTILINGUAL ASR BACKEND TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_all_tests()
