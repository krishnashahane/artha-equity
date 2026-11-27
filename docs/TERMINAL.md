# Artha Terminal

Open `/#terminal`, click **Terminal** in the top navigation, or press `` ` `` (backtick)
outside a text field. Press `` ` `` again or type `EXIT` to return.

The terminal is presentation only. It shows three kinds of value, each labelled:

| Label | Meaning | Example |
|---|---|---|
| `FACT` | Reported figure from a reviewed filing, with page | FY2026 revenue ₹1,78,650 Cr (PDF p.3) |
| `ASM` | Analyst assumption you can change | 9% FY2027E growth |
| `CALC` | Python calculation from facts + assumptions | ₹1,94,728.5 Cr FY2027E revenue |
| `INTERP` | Explanation of evidence (assistant) | “Revenue grew because…” |

## Commands

| Command | Effect |
|---|---|
| `HELP` | List commands |
| `INFY` / `LOAD INFY` | Load a reviewed issuer (ticker, id, scrip or ISIN) |
| `LOAD TCS` | Peer-only issuers explain what evidence would activate their own DCF |
| `DES` `FA` `DCF` `SENS` `COMP` `CHK` `EVID` | Focus a panel |
| `GP REV` / `GP EBIT` / `GP CFO` / `GP FCFF` | Switch the graph |
| `BASE` `BULL` `BEAR` | Load a compiled scenario |
| `WACC 11.5` `TG 4.5` `TAX 25` `MARGIN 21` | Change one assumption (percent) and recalculate in Python |
| `GROW 9 8 7 6 5` | Five annual revenue growth rates |
| `DA 2.7` `CAPEX 1.6` `NWC 17` | Reinvestment ratios, % of revenue |
| `MC 1000` | Seeded Monte Carlo (100–5000 paths) |
| `RDCF 1500` | Growth implied by a *hypothetical* price |
| `ASK <question>` | Evidence-mode (or validated LLM) explanation with citations |
| `SRCH <terms>` | BM25 search over reviewed facts |
| `ASM` `EXP` `CSV` | Full assumptions editor, research packet, forecast CSV |
| `CLR` `EXIT` | Clear console, leave terminal |

Keys: Enter runs · ↑/↓ history · Tab completes · Esc clears · F1 HELP, F2 DES, F3 FA,
F4 DCF, F6 SENS, F7 COMP, F8 EVID, F9 MC (F5 is left to the browser).
Assumption fields in the ASM panel recalculate on Enter.

## What it will not show

No market price, market cap or upside appears until a reviewed same-date BSE close and a
matching dated share count are imported. A provider quote or a reverse-DCF price cannot
stand in for that evidence.
