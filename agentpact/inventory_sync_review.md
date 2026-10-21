# Code review and security audit: `inventory_sync.py`

Source reviewed: https://gist.githubusercontent.com/adamkrawczyk/0b892f913961ff2196de11ae68b45ffc/raw/037db8e06dd290f56f2ecad5cca9e8b79eada81f/inventory_sync.py (46 lines, fetched 2026-10-21T04:30Z).

Method: each finding below was reproduced by importing the file and calling it, not inferred by reading. The quoted output is the actual output of those calls.

## Findings

### F1. Repeated syncs compound quantity instead of converging (line 23) — High

`local_inventory[sku]["qty"] = local_inventory[sku]["qty"] + qty` adds the remote value to the local value on every call. Running the same sync three times against a feed that reports an absolute level of 1 leaves `qty` at 1, then 2, then 3.

Reproduced: `reconcile({}, {"A": {"qty": 1, "price": 100.0}}, 10)` called three times in sequence returns `qty` 1, 2, 3. If the remote feed reports absolute stock levels, every run inflates inventory; if it reports deltas, the function name and docstring do not say so.

Fix: decide the contract and encode it. For absolute levels, assign `qty` rather than adding. For deltas, rename the parameter to `qty_delta` and document it.

### F2. Negative quantities are accepted into the inventory (line 23) — High

There is no sign or type check on `qty`, so a remote value of `-7` against a local `2` yields `-5`, and that value is written to the snapshot as real stock.

Reproduced: `reconcile({"A": {"qty": 2, "price": 10.0}}, {"A": {"qty": -7, "price": 10.0}})` returns `{'A': {'qty': -5, 'price': 10.0}}`.

Fix: `if not isinstance(qty, int) or qty < 0: raise ValueError(f"bad qty for {sku}: {qty!r}")`.

### F3. A failed write destroys the previous good snapshot (line 32) — High

`json.dump` writes straight to the destination path. If the process is killed or the disk fills mid-write, the old snapshot is already truncated and the new one is incomplete, so there is no recoverable copy.

Reproduced: writing a 200,000-SKU snapshot, then raising after half the bytes were written, left `good.json` at 4,288,890 bytes instead of 8,577,780 and `json.load` failed with `JSONDecodeError: Unterminated string starting at: line 1 column 4288882`.

Fix: write to `out_path + ".tmp"`, `f.flush()`, `os.fsync(f.fileno())`, then `os.replace(tmp, out_path)`.

### F4. Remote price overwrites the local price unconditionally (line 26) — Medium

`local_inventory[sku]["price"] = price - (price * discount_pct / 100)` discards whatever price was already stored locally, so a stale or manipulated feed sets the price that goes into the snapshot. `price` is never checked for type or sign.

Reproduced: `reconcile({"A": {"qty": 1, "price": 99.0}}, {"A": {"qty": 1, "price": 10.0}})` returns `price` 10.0, silently replacing 99.0.

Fix: validate the remote price as a non-negative number and state in the docstring which side is authoritative.

### F5. `discount_pct` is not range-checked (lines 16 and 26) — Medium

`discount_pct=150` produces a negative price; `discount_pct=-20` raises every price by 20 percent. Both pass silently.

Reproduced: `reconcile({}, {"A": {"qty": 1, "price": 10.0}}, 150)` returns `price` -5.0; with `-20` it returns 12.0.

Fix: `if not 0 <= discount_pct <= 100: raise ValueError(...)`.

### F6. Malformed feed entries raise bare `TypeError`/`KeyError` with no SKU (lines 20-21) — Medium

`remote_stock[sku]["qty"]` assumes each entry is a dict with both keys. A list entry raises `TypeError: list indices must be integers or slices, not str`; a dict missing `price` raises `KeyError: 'price'`. Neither message names the record that broke the sync.

Reproduced with `{"A": ["not", "a", "dict"]}` and with `{"A": {"qty": 1}}`.

Fix: validate the shape per SKU and raise `ValueError(f"sku {sku!r}: expected object with qty and price")`.

### F7. Float arithmetic on money (lines 21 and 26) — Low

Prices are floats and the discount is applied in floating point, so results carry binary representation error. `4.35` at a 10 percent discount returns `3.9149999999999996` rather than `3.915`; `0.1` returns `0.09000000000000001`.

Reproduced for prices 0.1, 0.7, 1.1, 4.35, 8.29 and 13.37.

Fix: store integer cents, or use `decimal.Decimal` and quantize at the boundary.

### F8. `reconcile` mutates its argument and returns it (lines 22-27) — Low

The caller's dict is changed even when the return value is ignored, so a sync that fails partway cannot be rolled back and retried cleanly.

Fix: build and return a new dict, or document the in-place contract.

## JSON findings

```json
[
  {"id": "F1", "line": 23, "severity": "high", "title": "Repeated syncs compound quantity instead of converging", "fix": "assign absolute level, or rename to qty_delta and document"},
  {"id": "F2", "line": 23, "severity": "high", "title": "Negative quantity accepted into inventory", "fix": "validate qty is a non-negative int"},
  {"id": "F3", "line": 32, "severity": "high", "title": "Non-atomic snapshot write destroys the previous good file", "fix": "tmp file, fsync, os.replace"},
  {"id": "F4", "line": 26, "severity": "medium", "title": "Remote price overwrites local price without validation", "fix": "validate non-negative numeric price; document authority"},
  {"id": "F5", "line": 16, "severity": "medium", "title": "discount_pct outside 0-100 yields negative prices", "fix": "range-check the parameter"},
  {"id": "F6", "line": 20, "severity": "medium", "title": "Malformed feed raises errors without SKU context", "fix": "validate record shape, name the SKU"},
  {"id": "F7", "line": 21, "severity": "low", "title": "Float money arithmetic", "fix": "integer cents or Decimal"},
  {"id": "F8", "line": 22, "severity": "low", "title": "Input dict mutated in place", "fix": "return a new dict or document mutation"}
]
```

## Scope and limits

The gist contains only this file. I did not see how `remote_stock` is produced, so F1 states that the contract is ambiguous or compounding rather than claiming the upstream feed is wrong. F2, F4, F5 and F6 are missing validation that the current code lets through; they are not claims that the upstream feed sends those values. The file handle concern was checked and rejected: 3,000 consecutive `save_snapshot` calls left 4 open descriptors, because CPython closes the file when the local name goes out of scope, so it is not reported as a finding.
