#!/usr/bin/env python3
"""
AstroTeam - Delighting de la textura LROC WAC (extracción de albedo)
===================================================================
La foto WAC trae sombras "quemadas" del momento de la toma orbital. Para que la
iluminación de Three.js sea 100% dinámica, se eliminan las bajas frecuencias
(sombreado macro) en el dominio logarítmico (filtro homomórfico):

    log(I) = log(albedo) + log(iluminación)
    detalle = log(I) - GaussLowPass(log(I))      -> se conserva el micro-relieve
    salida  = gris_medio + contraste * detalle

Los píxeles en sombra total (PSR, I≈0) no contienen información de albedo:
se enmascaran y se rellenan con gris neutro (convolución normalizada), evitando
que el filtro genere halos oscuros alrededor de los cráteres.

Uso:
    python backend/gdal_pipeline/delight_wac.py
    python backend/gdal_pipeline/delight_wac.py --sigma 24 --contrast 0.09
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IN = PROJECT_ROOT / "public" / "textures" / "skin_wac_2k.webp"
DEFAULT_OUT = PROJECT_ROOT / "public" / "textures" / "albedo_wac_delighted.webp"

try:  # cv2 es opcional; si no está, se usa un Gaussiano por FFT en numpy.
    import cv2  # type: ignore
except ImportError:  # pragma: no cover
    cv2 = None


def gaussian_blur(img: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussiano 2D. Usa cv2 si existe; si no, FFT con padding reflejado."""
    if cv2 is not None:
        return cv2.GaussianBlur(img, (0, 0), sigmaX=sigma, sigmaY=sigma, borderType=cv2.BORDER_REFLECT)

    pad = int(np.ceil(3 * sigma))
    padded = np.pad(img, pad, mode="reflect")
    h, w = padded.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    kernel = np.exp(-2.0 * (np.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))
    out = np.fft.irfft2(np.fft.rfft2(padded) * kernel, s=padded.shape)
    return out[pad:-pad, pad:-pad]


def delight(gray: np.ndarray, sigma: float, contrast: float, mid: float, shadow_thresh: float) -> np.ndarray:
    eps = 1.0 / 255.0
    valid = (gray > shadow_thresh).astype(np.float64)
    log_i = np.log(gray + eps)

    # Convolución normalizada: el paso bajo sólo promedia píxeles iluminados.
    num = gaussian_blur(log_i * valid, sigma)
    den = gaussian_blur(valid, sigma)
    low = num / np.maximum(den, 1e-6)

    detail = (log_i - low) * valid
    # Atenuación suave cerca de zonas en sombra total (evita bordes duros).
    detail *= np.clip(den * 1.5, 0.0, 1.0)

    std = detail[valid > 0].std() if valid.any() else 1.0
    out = mid + contrast * (detail / max(std, 1e-6))
    return np.clip(out, 0.0, 1.0)


def main() -> None:
    p = argparse.ArgumentParser(description="Delighting (albedo) de la textura WAC")
    p.add_argument("--input", type=Path, default=DEFAULT_IN)
    p.add_argument("--output", type=Path, default=DEFAULT_OUT)
    p.add_argument("--sigma", type=float, default=24.0, help="Radio del paso bajo en px (~10 km a 2048 px)")
    p.add_argument("--contrast", type=float, default=0.09, help="Desviación estándar del detalle en la salida (0-1)")
    p.add_argument("--mid", type=float, default=0.55, help="Gris medio del albedo lunar (0-1)")
    p.add_argument("--shadow-thresh", type=float, default=0.03, help="Umbral de sombra total (0-1)")
    p.add_argument("--quality", type=int, default=90)
    args = p.parse_args()

    img = Image.open(args.input).convert("L")
    gray = np.asarray(img, dtype=np.float64) / 255.0

    out = delight(gray, args.sigma, args.contrast, args.mid, args.shadow_thresh)
    out8 = (out * 255.0 + 0.5).astype(np.uint8)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out8, mode="L").convert("RGB").save(args.output, "WEBP", quality=args.quality)

    print(f"[✓] Backend de blur: {'cv2' if cv2 is not None else 'numpy FFT'}")
    print(f"[✓] Entrada  : {args.input}  (media={gray.mean():.3f}, std={gray.std():.3f}, "
          f"sombra total={np.mean(gray <= args.shadow_thresh) * 100:.1f}%)")
    print(f"[✓] Salida   : {args.output}  (media={out.mean():.3f}, std={out.std():.3f})")


if __name__ == "__main__":
    main()
