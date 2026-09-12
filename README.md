# Short-Term Stock Selection Agent (V1)

Educational, paper-trading-only scanner for 2–10 trading-day NSE swing setups.
It calculates indicators and ranks setups with deterministic Python rules. It
does **not** contain any broker order-placement code.

## What V1 includes

- EMA 20/50, RSI 14, MACD, ATR 14, 20-day breakout and volume confirmation
- Relative strength versus a benchmark
- Hard risk filters before a setup can qualify
- Entry, stop-loss, two targets and a transparent 0–100 score
- SQLite paper-trade journal with duplicate protection
- Free deterministic demo mode (no account or API token required)
- Optional Upstox V3 historical-candle integration
- Unit tests

## Install on macOS/Linux

```bash
cd stock-selection-agent
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Run immediately without credentials

```bash
python -m stock_agent.cli scan --source demo --top 5
python -m stock_agent.cli paper-list
```

Demo prices are synthetic and are only for checking the software flow. They are
not current market prices or recommendations.

## Run with Upstox historical data

1. Copy `.env.example` to `.env`.
2. Put your Upstox access token in `.env`.
3. Keep or edit `data/watchlist.csv`.
4. Run:

```bash
python -m stock_agent.cli scan --source upstox --top 5
```

The watchlist uses Upstox `instrument_key` values, not trading symbols alone.
The scanner only calls the historical-candle endpoint. It cannot place orders.

## Useful commands

```bash
# Show every stock, including rejected candidates and rejection reasons
python -m stock_agent.cli scan --source demo --show-rejected

# Do not save qualifying signals to the paper journal
python -m stock_agent.cli scan --source demo --no-record

# Use another SQLite file
python -m stock_agent.cli scan --source demo --db data/my_paper_trades.db

# Run tests
pytest -q
```

## Score model

| Component | Maximum |
|---|---:|
| Trend / EMA alignment | 20 |
| RSI momentum | 10 |
| MACD confirmation | 10 |
| Volume confirmation | 15 |
| Breakout proximity | 15 |
| Relative strength vs benchmark | 10 |
| Market regime | 10 |
| Risk/reward quality | 10 |
| **Total** | **100** |

Labels: 80+ Strong Setup, 70–79 Good Setup, 60–69 Watchlist, below 60
Reject. A candidate can also be rejected by a hard risk rule even when its raw
score is high.

## Safety boundary

This project is a research and learning tool, not investment advice. It does
not guarantee profit. Validate the strategy through historical testing and a
large paper-trading sample before considering any real-money decision.

