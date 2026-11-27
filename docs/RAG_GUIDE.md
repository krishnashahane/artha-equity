# Retrieval and grounded explanations

## The concept

Retrieval-augmented generation has two distinct jobs: find relevant evidence, then explain it using a model. A language model is not a source of financial truth. This project retrieves reviewed, page-linked financial facts and keeps calculations in the deterministic engine.

## What is implemented

`public/retrieval.js` creates one document per reviewed source fact. It retains company, year, field, units, document ID, publication date, URL and PDF page. Peer facts use their approved source documents. The corpus is constructed from the committed snapshot; arbitrary web pages are not ingested.

The retriever uses BM25. At a high level:

1. Split text and question into normalized words, removing common words.
2. Reward words that appear in a relevant fact.
3. Give rarer words more weight than words that occur everywhere.
4. Reduce the extra reward for repeated terms and normalize for document length.
5. Return the highest-ranked matching facts with source metadata.

No matching words means no invented evidence chunk. BM25 is lexical retrieval, not a semantic embedding model. Synonyms and multilingual questions can therefore retrieve poorly. The deterministic evidence explainer covers a defined set of financial questions and otherwise returns a coverage limitation.

## Generation

Without a key, the application explains supported facts/calculations using deterministic evidence responses. The UI calls this evidence mode and displays retrieved evidence separately.

With a configured local-server LLM, `/api/assistant` supplies retrieved facts and the deterministic research packet to the model. It requires JSON, valid source IDs and supported numbers. Failed validation or network errors produce an evidence-mode fallback. This does not guarantee every semantic claim is correct; human review is still necessary.

## Evaluation and extensions

Automated checks verify matching factual retrieval, empty retrieval for an unmatched query, existing source IDs, citation presence and refusal of unsupported questions. Extend this into a realistic evaluation set with paraphrases, wrong-company queries, date conflicts, unit traps and adversarial source text before claiming broad research coverage.

A full PDF-document pipeline would additionally need page-aware PDF extraction, reviewed text chunks, storage, source-file fingerprints, retrieval evaluation and optional embeddings. Those PDF features are outside this structured-fact implementation.
