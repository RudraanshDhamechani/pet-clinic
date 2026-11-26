"""
analytics.py — Deduplicated Pandas aggregations and Plotly/Matplotlib
visualizations for Pawsitive Care Veterinary Clinic.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

CLINIC_BLUE = "#0284C7"
CLINIC_TEAL = "#0D9488"
CLINIC_SLATE = "#334155"
STATUS_COLORS = {
    "Completed": "#16A34A",
    "Upcoming": "#D97706",
    "Due Today": "#EA580C",
    "Overdue": "#DC2626",
}


def filter_analytics_df(
    df: pd.DataFrame,
    start_date: str,
    end_date: str,
    species: str,
    vaccine: str,
) -> pd.DataFrame:
    """Filter vaccination records while preventing duplicate record counting."""
    if df.empty:
        return df

    filtered = df.drop_duplicates(subset=["vaccination_id"]).copy()
    filtered = filtered[
        (filtered["vaccination_date"] >= start_date)
        & (filtered["vaccination_date"] <= end_date)
    ]
    if species != "All":
        filtered = filtered[filtered["species"] == species]
    if vaccine != "All":
        filtered = filtered[filtered["vaccine_name"] == vaccine]
    return filtered


def chart_monthly_trend(df: pd.DataFrame) -> go.Figure:
    """1. Monthly vaccination trends using a Plotly line chart."""
    work = df.copy()
    work["month"] = work["vaccination_date"].str.slice(0, 7)
    grouped = work.groupby("month", as_index=False)["vaccination_id"].nunique()
    grouped = grouped.rename(columns={"vaccination_id": "doses"}).sort_values("month")

    fig = px.line(
        grouped,
        x="month",
        y="doses",
        markers=True,
        title="Monthly Vaccination Trend",
        labels={"month": "Month", "doses": "Vaccinations Administered"},
    )
    fig.update_traces(line_color=CLINIC_BLUE, line_width=2.5, marker_size=7)
    fig.update_layout(template="plotly_white", margin=dict(l=20, r=20, t=45, b=20))
    return fig


def chart_top_vaccines(df: pd.DataFrame) -> go.Figure:
    """2. Most commonly administered vaccines using a Plotly bar chart."""
    grouped = (
        df.groupby("vaccine_name", as_index=False)["vaccination_id"]
        .nunique()
        .rename(columns={"vaccination_id": "doses"})
        .sort_values("doses", ascending=False)
    )
    fig = px.bar(
        grouped,
        x="vaccine_name",
        y="doses",
        title="Most Commonly Administered Vaccines",
        labels={"vaccine_name": "Vaccine", "doses": "Doses Administered"},
        color_discrete_sequence=[CLINIC_TEAL],
    )
    fig.update_layout(template="plotly_white", margin=dict(l=20, r=20, t=45, b=20))
    return fig


def chart_species_distribution(df: pd.DataFrame) -> go.Figure:
    """3. Vaccination distribution by species using a Plotly pie/donut chart."""
    grouped = (
        df.groupby("species", as_index=False)["vaccination_id"]
        .nunique()
        .rename(columns={"vaccination_id": "doses"})
    )
    fig = px.pie(
        grouped,
        names="species",
        values="doses",
        hole=0.42,
        title="Vaccination Distribution by Species",
        color_discrete_sequence=[CLINIC_BLUE, CLINIC_TEAL, "#0EA5E9", "#64748B", "#14B8A6"],
    )
    fig.update_layout(template="plotly_white", margin=dict(l=20, r=20, t=45, b=20))
    return fig


def chart_monthly_comparison(df: pd.DataFrame) -> go.Figure:
    """4. Monthly comparison of vaccinations across calendar years."""
    work = df.copy()
    work["year"] = work["vaccination_date"].str.slice(0, 4)
    work["month_num"] = work["vaccination_date"].str.slice(5, 7).astype(int)
    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    work["month_name"] = work["month_num"].apply(lambda m: month_labels[m - 1])

    grouped = (
        work.groupby(["month_num", "month_name", "year"], as_index=False)["vaccination_id"]
        .nunique()
        .rename(columns={"vaccination_id": "doses"})
        .sort_values("month_num")
    )
    fig = px.bar(
        grouped,
        x="month_name",
        y="doses",
        color="year",
        barmode="group",
        title="Monthly Comparison Across Years",
        labels={"month_name": "Month", "doses": "Doses", "year": "Year"},
        color_discrete_sequence=["#94A3B8", CLINIC_TEAL, CLINIC_BLUE],
    )
    fig.update_layout(template="plotly_white", margin=dict(l=20, r=20, t=45, b=20))
    return fig


def chart_status_statistics(df: pd.DataFrame) -> go.Figure:
    """5. Upcoming and overdue vaccination status statistics."""
    order = ["Completed", "Upcoming", "Due Today", "Overdue"]
    counts = df.groupby("status")["vaccination_id"].nunique().to_dict()
    rows = [{"status": s, "count": counts.get(s, 0)} for s in order]
    status_df = pd.DataFrame(rows)

    fig = px.bar(
        status_df,
        x="status",
        y="count",
        color="status",
        title="Vaccination Schedule Status Breakdown",
        labels={"status": "Status", "count": "Records"},
        color_discrete_map=STATUS_COLORS,
    )
    fig.update_layout(
        template="plotly_white",
        showlegend=False,
        margin=dict(l=20, r=20, t=45, b=20),
    )
    return fig


def chart_yearly_comparison_matplotlib(df: pd.DataFrame):
    """6. Yearly vaccination comparison rendered cleanly with Matplotlib."""
    work = df.copy()
    work["year"] = work["vaccination_date"].str.slice(0, 4)
    grouped = (
        work.groupby("year", as_index=False)["vaccination_id"]
        .nunique()
        .rename(columns={"vaccination_id": "doses"})
        .sort_values("year")
    )

    fig, ax = plt.subplots(figsize=(6.5, 3.8))
    bars = ax.bar(grouped["year"], grouped["doses"], color=CLINIC_BLUE, width=0.48)
    ax.set_title("Yearly Vaccination Comparison", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Calendar Year")
    ax.set_ylabel("Doses Administered")
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    for bar in bars:
        height = bar.get_height()
        ax.annotate(
            f"{int(height)}",
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            fontsize=10,
            fontweight="bold",
        )
    fig.tight_layout()
    return fig
