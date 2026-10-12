# Lab Req Voice

An Ontario lab requisition eForm for [OSCAR EMR](https://oscarcanada.org/) that lets a clinician dictate the tests instead of hunting for checkboxes. Click **Dictate labs**, say *"CBC, lytes, A1C and a lipid panel"*, click again, and the right boxes are ticked. Speech recognition and matching run entirely in the browser. No audio or text leaves the computer.

**Try it:** [andrewk512.github.io/lab-req-voice](https://andrewk512.github.io/lab-req-voice/) uses a fictional patient and submits nothing. The first dictation downloads about 57 MB of models, which the browser then caches.

## What it does

- **Voice ordering.** Speech becomes a transcript, and each test phrase in it is matched to a box on the requisition. Tests with no box are written into *Other Tests*. Negations ("no PSA") untick a box. A panel shows what was heard, what was ticked, and anything it was unsure of, with an **Undo** button.
- **Companion auto-fill.** Ticking some boxes ticks their usual partners. For example, Sodium adds Potassium and Creatinine, and Chlamydia adds GC. The rules were mined from past submissions of the form. Auto-ticked boxes get a dotted outline on screen, never on paper. The script only unticks boxes it ticked itself, and once you touch a box, it is yours.

## How the voice part works

```
microphone ─▶ Whistle (speech → text) ─▶ phrase matcher ─▶ checkboxes / Other Tests
                  ▲ keyword biasing          │
                  └── lab vocabulary ◀───────┤ 1. exact alias ("lytes", "a1c", "pt inr")
                                             │ 2. Needle 3 embedding vs. prebuilt index
                                             └ 3. Needle 3 tool call (optional, suggest-only)
```

1. **Transcription.** The audio is captured at 16 kHz and transcribed by **Whistle** while you speak. The form's lab vocabulary is passed to Whistle as keywords, so that words like "bicarb" and "monospot" come through intact.
2. **Matching.** Each phrase is first checked against a list of aliases for every test. Anything left over is embedded with **Needle 3** and compared with `lab-req-voice-index.js`, a precomputed index of test descriptions. A strong, clear match ticks the box. A weaker one is shown as a tap-to-add suggestion.
3. **Isolation.** The engine runs in a Web Worker whose network APIs are replaced before the engine loads, so it cannot reach a server. The page hands it the wasm and models as bytes. All files are served by your own OSCAR, and offline mode refuses any other origin.

## Whistle, Needle and Cactus

[Cactus Compute](https://cactuscompute.com/) builds AI that runs on the device itself, such as phones, wearables, robots and microcontrollers, rather than in the cloud. Their models ship as single `.cact` files, compressed to 2–4 bits per weight with *Cactus Quants*. One small C engine reads any `.cact` file in place and runs it on the CPU, with no GPU and no dependencies. The same engine compiles to WebAssembly, which is how this eForm runs it in a browser tab.

- **[Whistle](https://huggingface.co/Cactus-Compute/whistle)** is a 16.9 MB speech-to-text model. It transcribes English, German, French, Spanish, Italian, Dutch and Polish, with up to 30 s per pass and streaming beyond that. It also returns word-level timestamps with confidence and supports keyword biasing. Silence produces an empty transcript rather than an invented sentence. It uses an audio encoder plus a Needle-shaped decoder, so it reuses Needle's container and runtime.
- **[Needle 3](https://huggingface.co/Cactus-Compute/needle3)** is a small foundation model (121M parameters at 20 layers, 8–29 MB) built for tool calling, structured extraction and text embeddings rather than chat. Its output is constrained by a grammar so it always parses, and every answer carries a calibrated confidence score. Every depth from 2 to 20 layers is itself a usable model. Here it provides the embeddings for fuzzy matching. Its tool-calling mode can be turned on to produce suggestions, which are never applied automatically.

Both models and the engine are released by Cactus Compute under the Apache License 2.0.

## Files

| File | What it is |
| --- | --- |
| `LabReq20212/LabReq20212.html` | The eForm, with the auto-fill and voice loader inlined |
| `LabReq20212/kai_lab_req_2019_05_31.png` | Requisition background image |
| `LabReq20212/eform.properties` | OSCAR eForm metadata |
| `LabReq20212.zip` | The eForm folder, packaged for import into OSCAR |
| `lab-req-voice-config.js` | Voice settings (JSON). Voice is off unless `"enabled": true` |
| `lab-req-voice-index.js` | Precomputed Needle 3 embeddings of the lab vocabulary |
| `whistle.cact.js` | Cactus Whistle model (upstream `whistle.cact`) |
| `needle3.cact.js` | Cactus Needle 3 model (upstream `needle3.cact`) |
| `needle.wasm.js` | Cactus engine compiled to WebAssembly (upstream `wasm/needle.wasm`) |
| `scripts/build-demo.mjs` | Builds the standalone GitHub Pages demo into `_site/` |

The three Cactus files are byte-for-byte identical to the upstream releases. Only a `.js` suffix has been added to their names. The loader checks their SHA-256 hashes before use:

```
b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb  whistle.cact.js
c9d915eca282ed42d1a09b143b592adb4cc6744ffe2d294adf5cfc5548170c38  needle3.cact.js
70bdb02b80d062b52cab1597e508b71172a7b355fc448840077a3929170a0733  needle.wasm.js
```

## Installing in OSCAR

1. Import `LabReq20212.zip` as an eForm, or upload `LabReq20212.html` and its background image.
2. Upload `lab-req-voice-config.js`, `lab-req-voice-index.js`, `whistle.cact.js`, `needle3.cact.js` and `needle.wasm.js` to the eForm image library. The form loads them through `../eform/displayImage.do?imagefile=…`.
3. Open a new requisition for a patient. The **Dictate labs** button appears when the config says `"enabled": true`. The browser needs microphone permission, and OSCAR must be served over HTTPS.

To switch voice off for everyone, set `"enabled": false` in the config, or remove it. The rest of the form keeps working.

### Settings

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Show the Dictate labs button |
| `offline` | `true` | Only load files from this OSCAR's origin |
| `thresholds.embedAccept` | `0.45` | Similarity needed to tick a box from an embedding match |
| `thresholds.embedSuggest` | `0.30` | Similarity needed to offer a match as a suggestion |
| `thresholds.embedMargin` | `0.10` | How far the best match must lead the runner-up to be ticked |
| `thresholds.wordConfidenceFloor` | `0.40` | Whistle word confidence below which a match is only suggested |
| `thresholds.temperature` | `0.05` | Softmax temperature when scoring embedding matches |
| `thresholds.needleEnabled` | `false` | Also ask Needle 3 (tool calling) about phrases nothing else matched |
| `thresholds.needleSuggest` | `0.10` | Needle confidence needed to show its answer as a suggestion |

## Licenses

The Cactus Whistle and Needle 3 models and the Cactus engine (`whistle.cact.js`, `needle3.cact.js`, `needle.wasm.js` and the needle.js glue embedded in the eForm) are © Cactus Compute and licensed under the [Apache License 2.0](LICENSES/Apache-2.0.txt). See [NOTICE](NOTICE).

This is not a medical device. Always check the requisition before you sign it.
