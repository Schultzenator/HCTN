# Mapping equity baseline

Public-data audit, tabular gradient-boosting training code, and a format-checked constant baseline for the Zindi Bias Bounty Mapping Equity Challenge.

**No organizer labels are public in the current package. Real-target training and five-fold RMSE are blocked.** The supplied submission uses 0.5 in every score column. It is not a trained-model submission. Exact agreement with the separately hosted Zindi sample remains unverified because that download requires authentication.

Run from the repository root:

```bash
python3 -m venv zindi-bias/.venv
zindi-bias/.venv/bin/pip install -r zindi-bias/requirements-lock.txt
python3 zindi-bias/scripts/download_data.py
zindi-bias/.venv/bin/python zindi-bias/scripts/audit_data.py
python3 zindi-bias/scripts/build_submission.py
python3 zindi-bias/scripts/validate_submission.py
zindi-bias/.venv/bin/python zindi-bias/scripts/check_pipeline.py
```

Parquet data, virtual environments and model binaries are ignored by git. Downloads remain locally under `data/`; their URLs, expected sizes and SHA-256 hashes are committed in `data/download-manifest.json`. Re-running downloads reuses local files with the expected sizes; `--refresh` retrieves fresh copies. The complete public inventory and source README are committed.

If legitimate organizer-provided labels become available, put them under `zindi-bias/data/` and run:

```bash
zindi-bias/.venv/bin/python zindi-bias/scripts/train_baseline.py \
  --labels zindi-bias/data/organizer-training.csv \
  --label-source 'Organizer-provided training release, URL and release date' \
  --region northern-ca
```

This writes five-fold metrics to `reports/cv-results.json`, OOF predictions to `reports/oof.csv`, a model to `models/baseline.pkl`, and predictions to `submission/submission.csv`. The primary score is modeled; optional component scores remain 0.5 constants. Training replaces the constant submission. Do not feed regional sample templates as training labels, reconstruct prohibited targets, or treat synthetic checks as challenge CV.

See [EDA](EDA.md), [experiments](EXPERIMENTS.md), [results](RESULTS.md), [operator handoff](SUBMISSION-KIT.md), and [work state](WORK-STATE.md). No push or Zindi submission was performed.


## Local commit handoff

The workspace `.git` directory is mounted read-only. The requested `git add zindi-bias/` failed with “Unable to create .git/index.lock: Read-only file system”; the original branch was not changed. A local commit, with the original repository HEAD as parent, is preserved in the ignored `zindi-bias/local-history/` store and `zindi-bias/local-commit.bundle`.

Read-only inspection:

```bash
git --git-dir=zindi-bias/local-history log -1 --stat
git bundle verify zindi-bias/local-commit.bundle
```

After the operator restores normal write access to the workspace's `.git`, import the delivery commit onto a separate local branch without changing the working tree:

```bash
git fetch zindi-bias/local-commit.bundle zindi-bias-delivery:refs/heads/zindi-bias-delivery
```

This creates a local branch containing the commit. Inspect it with `git show zindi-bias-delivery`; integrate it into the desired branch using your normal local Git workflow. Do not push unless separately authorized. The bundle and auxiliary Git store are ignored to avoid recursively committing a repository into itself.
