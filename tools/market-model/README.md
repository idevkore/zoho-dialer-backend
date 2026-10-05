# Market model

Builds `docs/market/pricing-model.xlsx`, the HaulOS pricing model. Standalone: it shares nothing with the app and is not deployed.

```bash
cd tools/market-model
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python build_model.py
```

Open the workbook in Excel. Every figure outside the Assumptions sheet is a formula, so changing a blue cell recalculates the rest.

## Files

- `assumptions.py`: every input, with its source and a confidence (High, Med, Low or ASSUMPTION). Edit prices and drivers here, then rebuild.
- `build_model.py`: lays out the eight sheets and writes the formulas.
- `docs/market/inputs/usage-actuals.json`: measured usage. A null there falls back to the matching assumption on the `UsageActuals` sheet and is labeled ASSUMPTION. With one or two clean months the sheet uses the measured mean; with three or more it also uses P25 and P90 for the low and high cases.

## One-off what-ifs

```bash
.venv/bin/python build_model.py --set retention=3 --set min_ring=0 --out /tmp/what-if.xlsx
```

`--set` takes any input key from `assumptions.py`. `--actuals` reads another usage file. Neither changes the committed inputs.

## Limits

- Gross margin is tool cost only: no support, sales or payment fees.
- Recording storage is costed at a steady state of `retention` months. The dialer does not delete recordings today, so the real cost keeps growing until it does.
- Hosting per tenant on the Tiers sheet is at today's tenant count. The Forecast recomputes it each month.
- The workbook is saved without cached values. A viewer that does not calculate formulas shows blanks.
