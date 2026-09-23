# DT Tokenizer Provenance

## Recovered GPT-side lineage
- Historical executable: `dt_chatgpt_archive_tokenizer.py`.
- Historical validation checkpoint: `DT_TOKENIZER_VALIDATION_CHECKPOINT_v1_0.md`.
- Archive compatibility encoding: `o200k_base`.
- Official vocabulary SHA-256: `446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d`.
- Structural parser was executed and validated; exact counting remains fail-closed when the exact backend is unavailable.
- No bytes/4 or heuristic token approximation is permitted for canonical archive totals.

## DT-native lineage
- Runtime: `packages/core/src/dt-tokenizer.cjs`.
- Initial generation: `DT_NATIVE_TOKENIZER_1.0`.
- Reversible UTF-8 byte base plus versioned BPE merges.
- Reserved DT semantic tokens remain atomic across generations.
- Tokenizer configuration is content-hashed and must be bound to model/checkpoint metadata.
- Training produces a candidate configuration; promotion is a separate attributable action.

## Separation rule
Archive compatibility measurement and DT-native model tokenization are distinct. Neither may silently replace the other. Source history, tokenizer generations, model checkpoints, and migrations remain append-only provenance.