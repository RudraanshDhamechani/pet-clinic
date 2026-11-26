"""
ui_components.py — Reusable UI styling, KPI cards, status badges, and
in-app notification panels for Pawsitive Care Veterinary Clinic.
"""

from __future__ import annotations

import pandas as pd
import streamlit as st


def apply_clinic_styles() -> None:
    """Inject clean clinical blue, teal, and white Streamlit theme CSS."""
    st.markdown(
        """
        <style>
            .stApp {
                background-color: #F8FAFC;
                color: #0F172A;
            }
            section[data-testid="stSidebar"] {
                background-color: #FFFFFF;
                border-right: 1px solid #E2E8F0;
            }
            .clinic-kpi {
                background-color: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 10px;
                padding: 16px 18px;
            }
            .clinic-kpi-label {
                font-size: 12px;
                font-weight: 600;
                color: #475569;
                margin-bottom: 6px;
            }
            .clinic-kpi-value {
                font-size: 28px;
                font-weight: 700;
                color: #0F172A;
                line-height: 1.1;
            }
            .clinic-kpi-sub {
                font-size: 12px;
                color: #64748B;
                margin-top: 6px;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_kpi_card(label: str, value: int, subtitle: str) -> None:
    """Render a clean bordered clinical KPI card."""
    st.markdown(
        f"""
        <div class="clinic-kpi">
            <div class="clinic-kpi-label">{label}</div>
            <div class="clinic-kpi-value">{value}</div>
            <div class="clinic-kpi-sub">{subtitle}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def format_status_label(status: str) -> str:
    """Return a clear text + icon indicator for accessibility (never color-only)."""
    mapping = {
        "Completed": "✓ Completed",
        "Upcoming": "◔ Upcoming",
        "Due Today": "◷ Due Today",
        "Overdue": "⚠ Overdue",
    }
    return mapping.get(status, status)


def render_in_app_alerts(vax_df: pd.DataFrame) -> None:
    """Display in-app alerts for Due Today, Due Within 7 Days, and Overdue."""
    if vax_df.empty:
        st.info("No vaccination records logged yet.")
        return

    due_today = vax_df[vax_df["status"] == "Due Today"]
    due_7 = vax_df[(vax_df["status"] == "Upcoming") & (vax_df["due_within_7_days"])]
    overdue = vax_df[vax_df["status"] == "Overdue"]

    st.caption("In-App Clinic Alerts (no external SMS or email notifications are sent)")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.error(f"Overdue Vaccinations: {len(overdue)}")
        for _, r in overdue.head(4).iterrows():
            st.write(f"• **{r['pet_name']}** ({r['pet_id']}) — {r['vaccine_name']} due {r['next_due_date']}")
    with col2:
        st.warning(f"Due Today: {len(due_today)}")
        for _, r in due_today.head(4).iterrows():
            st.write(f"• **{r['pet_name']}** ({r['pet_id']}) — {r['vaccine_name']} due today")
    with col3:
        st.info(f"Due Within 7 Days: {len(due_7)}")
        for _, r in due_7.head(4).iterrows():
            st.write(f"• **{r['pet_name']}** ({r['pet_id']}) — {r['vaccine_name']} in {int(r['days_until_due'])}d")
