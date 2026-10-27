from __future__ import annotations


class LimitFields:
    login_rate_limit: int = 8
    login_rate_window_seconds: int = 60
    ws_revalidation_seconds: int = 15
