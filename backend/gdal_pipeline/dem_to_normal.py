#!/usr/bin/env python3
"""
AstroTeam - Normal map tangente (OpenGL / Three.js) a partir del LOLA DEM
=========================================================================
`normal_lola_2k.png` se generó con `gdaldem hillshade`, que produce niveles de
iluminación (media R,G ≈ 177), no componentes de normales (plano = 128,128,255).
Usado como normalMap inclina todas las normales y falsea la luz dinámica.

Este script calcula las normales reales del DEM con la MISMA exageración vertical
que usa el visor 3D, para que normal map y displacement sean coherentes.

    n = normalize(-dh/dx, -dh/dy, 1)      (x = columnas →, y = filas ↑)
    RGB = (n + 1) / 2 * 255

Uso:
    python backend/gdal_pipeline/dem_to_normal.py --displacement-scale 2.5 --plane-size 100
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IN = PROJECT_ROOT / "public" / "textures" / "displacement_lola_2k.png"
DEFAULT_OUT = PROJECT_ROOT / "public" / "textures" / "normal_lola_tangent_2k.png"


def main() -> None:
    p = argparse.ArgumentParser(description="DEM -> normal map tangente")
    p.add_argument("--input", type=Path, default=DEFAULT_IN)
    p.add_argument("--output", type=Path, default=DEFAULT_OUT)
    p.add_argument("--displacement-scale", type=float, default=2.5, help="displacementScale del material")
    p.add_argument("--plane-size", type=float, default=100.0, help="Lado del planeGeometry")
    p.add_argument("--smooth", type=float, default=1.0, help="Suavizado previo (px) contra el escalonado 8-bit")
    args = p.parse_args()

    img = Image.open(args.input).convert("L")
    if args.smooth > 0:
        img = img.filter(ImageFilter.GaussianBlur(args.smooth))
    # Altura en unidades de la escena (igual que el shader de displacement).
    h = np.asarray(img, dtype=np.float64) / 255.0 * args.displacement_scale
    texel = args.plane_size / h.shape[1]

    dh_drow, dh_dcol = np.gradient(h, texel)
    dh_dx = dh_dcol
    dh_dy = -dh_drow  # las filas crecen hacia abajo; +Y tangente apunta hacia arriba

    n = np.dstack([-dh_dx, -dh_dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    rgb = ((n + 1.0) * 0.5 * 255.0 + 0.5).astype(np.uint8)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, mode="RGB").save(args.output, "PNG", optimize=True)
    print(f"[✓] Normal map: {args.output}  (media RGB={rgb.reshape(-1, 3).mean(0).round(1)})")


if __name__ == "__main__":
    main()
