"""Small PostgREST client shared by the API and data-ingestion scripts."""

import os
from pathlib import Path
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


class SupabaseError(RuntimeError):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def _request(
    method: str,
    table: str,
    params: Optional[dict] = None,
    payload: Optional[list] = None,
    key_env: str = "SUPABASE_KEY",
    prefer: Optional[str] = None,
):
    project_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    api_key = os.getenv(key_env)
    if not project_url or not api_key:
        raise SupabaseError(
            503,
            f"Supabase is not configured. Set SUPABASE_URL and {key_env}.",
        )

    headers = {"apikey": api_key, "Accept": "application/json"}
    if api_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {api_key}"
    if prefer:
        headers["Prefer"] = prefer

    try:
        response = requests.request(
            method,
            f"{project_url}/rest/v1/{table}",
            params=params,
            json=payload,
            headers=headers,
            timeout=20,
        )
    except requests.Timeout as error:
        raise SupabaseError(504, "Supabase request timed out.") from error
    except requests.RequestException as error:
        raise SupabaseError(502, "Could not reach Supabase.") from error

    if not response.ok:
        raise SupabaseError(
            502,
            f"Supabase returned HTTP {response.status_code}. Check the table, key, and RLS policies.",
        )
    if not response.content:
        return None

    try:
        return response.json()
    except ValueError as error:
        raise SupabaseError(502, "Supabase returned invalid JSON.") from error


def select_rows(table: str, params: dict) -> List[Dict]:
    result = _request("GET", table, params=params)
    if not isinstance(result, list) or any(not isinstance(row, dict) for row in result):
        raise SupabaseError(502, "Supabase returned an unexpected response shape.")
    return result


def upsert_rows(
    table: str,
    rows: list,
    conflict_columns: str,
    key_env: str = "SUPABASE_SERVICE_ROLE_KEY",
):
    if not rows:
        return
    _request(
        "POST",
        table,
        params={"on_conflict": conflict_columns},
        payload=rows,
        key_env=key_env,
        prefer="resolution=merge-duplicates,return=minimal",
    )
