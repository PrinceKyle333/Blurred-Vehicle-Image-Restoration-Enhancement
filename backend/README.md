# Python & PyTorch Inference Backend

This directory contains the FastAPI + PyTorch REST service consumed by the Express gateway (`/api/models/status` and `/api/restore`).

## Expected Trained Checkpoints

Place your trained model files in `backend/checkpoints/` (or override paths via environment variables):

- `backend/checkpoints/deblurgan_v2.pth` (`DEBLURGAN_CHECKPOINT_PATH`)
- `backend/checkpoints/conditional_ddpm.pt` (`DDPM_CHECKPOINT_PATH`)
- `backend/checkpoints/restormer.pth` (`RESTORMER_CHECKPOINT_PATH`)

If checkpoints are exported via `torch.jit.trace` / `torch.jit.script`, `CheckpointRegistry` loads them automatically. For raw `state_dict` `.pth` files, instantiate the corresponding `nn.Module` inside `CheckpointRegistry._load_state_dict_model` in `backend/models.py`.

## Running Locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Then configure `PYTORCH_API_URL=http://127.0.0.1:8000` in the root environment before starting the web server (`npm run dev`).
