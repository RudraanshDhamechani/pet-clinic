"""
app.py — Main Streamlit Application for Pawsitive Care Veterinary Clinic
Pet Clinic Vaccination Log & Trend Analysis System.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pandas as pd
import streamlit as st

from analytics import (
    chart_monthly_comparison,
    chart_monthly_trend,
    chart_species_distribution,
    chart_status_statistics,
    chart_top_vaccines,
    chart_yearly_comparison_matplotlib,
    filter_analytics_df,
)
from database import (
    ALLOWED_GENDERS,
    ALLOWED_SPECIES,
    COMMON_VACCINES,
    add_pet,
    add_vaccination,
    delete_pet,
    delete_vaccination,
    get_pets_df,
    get_vaccinations_df,
    init_database,
    update_pet,
    update_vaccination,
    validate_pet_data,
    validate_vaccination_data,
)
from sample_data import seed_sample_data_if_empty
from ui_components import (
    apply_clinic_styles,
    format_status_label,
    render_in_app_alerts,
    render_kpi_card,
)

st.set_page_config(
    page_title="Pawsitive Care Veterinary Clinic — Vaccination Log & Analytics",
    page_icon="🐾",
    layout="wide",
)

init_database()
seed_sample_data_if_empty()
apply_clinic_styles()

with st.sidebar:
    st.title("Pawsitive Care")
    st.caption("Veterinary Clinic Immunization System")
    page = st.radio(
        "Clinic Navigation",
        [
            "Dashboard",
            "Register Pet",
            "Pet Records",
            "Add Vaccination",
            "Vaccination History",
            "Vaccination Tracker",
            "Trend Analysis",
            "Reports",
        ],
    )
    st.divider()
    st.caption("Demonstration records are clearly flagged as sample data.")

pets_df = get_pets_df()
vax_df = get_vaccinations_df()
today = date.today()
current_month_prefix = today.strftime("%Y-%m")

# ---------------------------------------------------------------------------
# 1. DASHBOARD
# ---------------------------------------------------------------------------
if page == "Dashboard":
    st.header("Clinic Dashboard")
    st.caption("Real-time overview of registered pets, immunization status, and monthly activity.")

    total_pets = len(pets_df)
    total_vax = len(vax_df)
    upcoming_cnt = int(((vax_df["status"] == "Upcoming") | (vax_df["status"] == "Due Today")).sum()) if not vax_df.empty else 0
    overdue_cnt = int((vax_df["status"] == "Overdue").sum()) if not vax_df.empty else 0
    completed_month = int(vax_df["vaccination_date"].str.startswith(current_month_prefix).sum()) if not vax_df.empty else 0

    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        render_kpi_card("Total Registered Pets", total_pets, "Active patient registry")
    with c2:
        render_kpi_card("Vaccination Records", total_vax, "Deduplicated clinic log")
    with c3:
        render_kpi_card("Upcoming & Due Today", upcoming_cnt, "Next 30 days window")
    with c4:
        render_kpi_card("Overdue Vaccinations", overdue_cnt, "Requires desk follow-up")
    with c5:
        render_kpi_card("Completed This Month", completed_month, f"Month {current_month_prefix}")

    st.subheader("Clinical Alerts & Reminders")
    render_in_app_alerts(vax_df)

    if not vax_df.empty:
        col_a, col_b = st.columns([3, 2])
        with col_a:
            st.plotly_chart(chart_monthly_trend(vax_df), use_container_width=True)
        with col_b:
            st.plotly_chart(chart_status_statistics(vax_df), use_container_width=True)

# ---------------------------------------------------------------------------
# 2. REGISTER PET
# ---------------------------------------------------------------------------
elif page == "Register Pet":
    st.header("Register New Pet")
    st.caption("Create a new patient profile with validated owner contact information.")

    with st.form("register_pet_form", clear_on_submit=True):
        col1, col2 = st.columns(2)
        with col1:
            pet_id = st.text_input("Unique Pet ID", placeholder="PET-1025")
            pet_name = st.text_input("Pet Name", placeholder="e.g., Archie")
            species = st.selectbox("Species", ALLOWED_SPECIES)
            breed = st.text_input("Breed", placeholder="e.g., Golden Retriever")
            age = st.number_input("Age (years)", min_value=0.0, max_value=40.0, step=0.5, value=1.0)
        with col2:
            gender = st.selectbox("Gender", ALLOWED_GENDERS)
            dob = st.date_input("Date of Birth", value=today - timedelta(days=365), max_value=today)
            owner_name = st.text_input("Owner Name", placeholder="Full name")
            owner_phone = st.text_input("Owner Phone", placeholder="(555) 123-4567")
            owner_email = st.text_input("Owner Email", placeholder="owner@example.com")

        submitted = st.form_submit_button("Register Pet", type="primary")
        if submitted:
            err = validate_pet_data(
                pet_id, pet_name, species, breed, age, gender, dob,
                owner_name, owner_phone, owner_email,
            )
            if err:
                st.error(err)
            else:
                ok, msg = add_pet(
                    {
                        "pet_id": pet_id,
                        "pet_name": pet_name,
                        "species": species,
                        "breed": breed,
                        "age": age,
                        "gender": gender,
                        "date_of_birth": dob.strftime("%Y-%m-%d"),
                        "owner_name": owner_name,
                        "owner_phone": owner_phone,
                        "owner_email": owner_email,
                    }
                )
                if ok:
                    st.success(msg)
                    st.rerun()
                else:
                    st.error(msg)

# ---------------------------------------------------------------------------
# 3. PET RECORDS
# ---------------------------------------------------------------------------
elif page == "Pet Records":
    st.header("Pet Directory & Records")
    search_q = st.text_input("Search by Pet ID, Pet Name, or Owner Name")
    species_filter = st.selectbox("Filter by Species", ["All"] + ALLOWED_SPECIES)

    filtered_pets = pets_df.copy()
    if search_q.strip():
        q = search_q.strip().lower()
        filtered_pets = filtered_pets[
            filtered_pets["pet_id"].str.lower().str.contains(q)
            | filtered_pets["pet_name"].str.lower().str.contains(q)
            | filtered_pets["owner_name"].str.lower().str.contains(q)
        ]
    if species_filter != "All":
        filtered_pets = filtered_pets[filtered_pets["species"] == species_filter]

    display_pets = filtered_pets.copy()
    display_pets["record_type"] = display_pets["is_sample"].apply(
        lambda x: "Demo Sample" if x == 1 else "Clinic Record"
    )
    st.dataframe(
        display_pets[
            [
                "pet_id", "pet_name", "species", "breed", "age", "gender",
                "date_of_birth", "owner_name", "owner_phone", "owner_email", "record_type",
            ]
        ],
        use_container_width=True,
        hide_index=True,
    )

    if not filtered_pets.empty:
        st.subheader("Update or Delete Pet")
        selected_id = st.selectbox("Select Pet to Edit/Delete", filtered_pets["pet_id"].tolist())
        row = pets_df[pets_df["pet_id"] == selected_id].iloc[0]

        with st.form("edit_pet_form"):
            c1, c2 = st.columns(2)
            with c1:
                e_name = st.text_input("Pet Name", value=row["pet_name"])
                e_species = st.selectbox("Species", ALLOWED_SPECIES, index=ALLOWED_SPECIES.index(row["species"]))
                e_breed = st.text_input("Breed", value=row["breed"])
                e_age = st.number_input("Age", min_value=0.0, max_value=40.0, step=0.5, value=float(row["age"]))
            with c2:
                e_gender = st.selectbox("Gender", ALLOWED_GENDERS, index=ALLOWED_GENDERS.index(row["gender"]))
                e_dob = st.date_input("Date of Birth", value=datetime.strptime(row["date_of_birth"], "%Y-%m-%d").date(), max_value=today)
                e_owner = st.text_input("Owner Name", value=row["owner_name"])
                e_phone = st.text_input("Owner Phone", value=row["owner_phone"])
                e_email = st.text_input("Owner Email", value=row["owner_email"])

            col_save, col_del = st.columns(2)
            with col_save:
                if st.form_submit_button("Save Changes", type="primary"):
                    err = validate_pet_data(
                        selected_id, e_name, e_species, e_breed, e_age,
                        e_gender, e_dob, e_owner, e_phone, e_email,
                    )
                    if err:
                        st.error(err)
                    else:
                        ok, msg = update_pet(
                            selected_id,
                            {
                                "pet_name": e_name,
                                "species": e_species,
                                "breed": e_breed,
                                "age": e_age,
                                "gender": e_gender,
                                "date_of_birth": e_dob.strftime("%Y-%m-%d"),
                                "owner_name": e_owner,
                                "owner_phone": e_phone,
                                "owner_email": e_email,
                            },
                        )
                        if ok:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)
            with col_del:
                if st.form_submit_button("Delete Pet Record"):
                    ok, msg = delete_pet(selected_id)
                    if ok:
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)

# ---------------------------------------------------------------------------
# 4. ADD VACCINATION
# ---------------------------------------------------------------------------
elif page == "Add Vaccination":
    st.header("Add Vaccination Record")
    if pets_df.empty:
        st.warning("Register a pet first before adding a vaccination record.")
    else:
        pet_options = {
            f"{r['pet_id']} — {r['pet_name']} ({r['species']})": r["pet_id"]
            for _, r in pets_df.iterrows()
        }
        with st.form("add_vaccination_form", clear_on_submit=True):
            chosen_label = st.selectbox("Registered Pet", list(pet_options.keys()))
            vaccine_choice = st.selectbox("Vaccine Name", list(COMMON_VACCINES) + ["Other"])
            custom_vaccine = st.text_input("If Other, enter vaccine name")
            c1, c2 = st.columns(2)
            with c1:
                vax_date = st.date_input("Vaccination Date", value=today, max_value=today)
            with c2:
                next_due = st.date_input("Next Due Date", value=today + timedelta(days=365))
            vet_name = st.text_input("Veterinarian Name", placeholder="Dr. Claire Vance")
            notes = st.text_area("Clinical Notes", placeholder="Dosage site, tolerance, batch remarks...")

            if st.form_submit_button("Save Vaccination Record", type="primary"):
                final_vaccine = custom_vaccine.strip() if vaccine_choice == "Other" else vaccine_choice
                pet_id_val = pet_options[chosen_label]
                err = validate_vaccination_data(pet_id_val, final_vaccine, vax_date, next_due, vet_name)
                if err:
                    st.error(err)
                else:
                    ok, msg = add_vaccination(
                        {
                            "pet_id": pet_id_val,
                            "vaccine_name": final_vaccine,
                            "vaccination_date": vax_date.strftime("%Y-%m-%d"),
                            "next_due_date": next_due.strftime("%Y-%m-%d"),
                            "veterinarian_name": vet_name,
                            "notes": notes,
                        }
                    )
                    if ok:
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)

# ---------------------------------------------------------------------------
# 5. VACCINATION HISTORY
# ---------------------------------------------------------------------------
elif page == "Vaccination History":
    st.header("Vaccination History")
    pet_choices = ["All Pets"] + [f"{r['pet_id']} — {r['pet_name']}" for _, r in pets_df.iterrows()]
    selected_pet_label = st.selectbox("Filter by Pet", pet_choices)

    hist_df = vax_df.copy()
    if selected_pet_label != "All Pets":
        target_id = selected_pet_label.split(" — ")[0]
        hist_df = hist_df[hist_df["pet_id"] == target_id]

    hist_df["status_label"] = hist_df["status"].apply(format_status_label)
    st.dataframe(
        hist_df[
            [
                "vaccination_id", "pet_id", "pet_name", "species", "vaccine_name",
                "vaccination_date", "next_due_date", "status_label", "veterinarian_name", "notes",
            ]
        ],
        use_container_width=True,
        hide_index=True,
    )

    if not hist_df.empty:
        st.subheader("Update or Delete Vaccination Record")
        rec_id = st.selectbox("Select Record ID", hist_df["vaccination_id"].tolist())
        rec = hist_df[hist_df["vaccination_id"] == rec_id].iloc[0]
        with st.form("edit_vax_form"):
            u_vaccine = st.text_input("Vaccine Name", value=rec["vaccine_name"])
            c1, c2 = st.columns(2)
            with c1:
                u_date = st.date_input("Vaccination Date", value=datetime.strptime(rec["vaccination_date"], "%Y-%m-%d").date(), max_value=today)
            with c2:
                u_due = st.date_input("Next Due Date", value=datetime.strptime(rec["next_due_date"], "%Y-%m-%d").date())
            u_vet = st.text_input("Veterinarian Name", value=rec["veterinarian_name"])
            u_notes = st.text_area("Notes", value=rec["notes"])

            col_s, col_d = st.columns(2)
            with col_s:
                if st.form_submit_button("Update Record", type="primary"):
                    err = validate_vaccination_data(rec["pet_id"], u_vaccine, u_date, u_due, u_vet)
                    if err:
                        st.error(err)
                    else:
                        ok, msg = update_vaccination(
                            int(rec_id),
                            {
                                "pet_id": rec["pet_id"],
                                "vaccine_name": u_vaccine,
                                "vaccination_date": u_date.strftime("%Y-%m-%d"),
                                "next_due_date": u_due.strftime("%Y-%m-%d"),
                                "veterinarian_name": u_vet,
                                "notes": u_notes,
                            },
                        )
                        if ok:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)
            with col_d:
                if st.form_submit_button("Delete Record"):
                    ok, msg = delete_vaccination(int(rec_id))
                    if ok:
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)

# ---------------------------------------------------------------------------
# 6. VACCINATION TRACKER
# ---------------------------------------------------------------------------
elif page == "Vaccination Tracker":
    st.header("Dynamic Vaccination Status Tracker")
    status_opt = st.radio(
        "Filter by Status",
        ["All", "Overdue", "Due Today", "Due Within 7 Days", "Upcoming", "Completed"],
        horizontal=True,
    )
    tracked = vax_df.copy()
    if status_opt == "Due Within 7 Days":
        tracked = tracked[(tracked["status"] == "Due Today") | ((tracked["status"] == "Upcoming") & (tracked["due_within_7_days"]))]
    elif status_opt != "All":
        tracked = tracked[tracked["status"] == status_opt]

    tracked["status_display"] = tracked["status"].apply(format_status_label)
    st.dataframe(
        tracked[
            [
                "pet_id", "pet_name", "species", "owner_name", "owner_phone",
                "vaccine_name", "vaccination_date", "next_due_date", "days_until_due", "status_display",
            ]
        ],
        use_container_width=True,
        hide_index=True,
    )

# ---------------------------------------------------------------------------
# 7. TREND ANALYSIS
# ---------------------------------------------------------------------------
elif page == "Trend Analysis":
    st.header("Vaccination Trend Analysis")
    if vax_df.empty:
        st.info("No vaccination records available for analytics.")
    else:
        min_d = datetime.strptime(vax_df["vaccination_date"].min(), "%Y-%m-%d").date()
        max_d = datetime.strptime(vax_df["vaccination_date"].max(), "%Y-%m-%d").date()

        f1, f2, f3, f4 = st.columns(4)
        with f1:
            start_d = st.date_input("Start Date", value=min_d)
        with f2:
            end_d = st.date_input("End Date", value=max_d)
        with f3:
            sp_opt = st.selectbox("Species", ["All"] + sorted(vax_df["species"].unique().tolist()))
        with f4:
            vax_opt = st.selectbox("Vaccine Type", ["All"] + sorted(vax_df["vaccine_name"].unique().tolist()))

        filtered = filter_analytics_df(
            vax_df,
            start_d.strftime("%Y-%m-%d"),
            end_d.strftime("%Y-%m-%d"),
            sp_opt,
            vax_opt,
        )

        if filtered.empty:
            st.warning("No matching vaccination records for the selected filters.")
        else:
            r1c1, r1c2 = st.columns(2)
            with r1c1:
                st.plotly_chart(chart_monthly_trend(filtered), use_container_width=True)
            with r1c2:
                st.plotly_chart(chart_top_vaccines(filtered), use_container_width=True)

            r2c1, r2c2 = st.columns(2)
            with r2c1:
                st.plotly_chart(chart_species_distribution(filtered), use_container_width=True)
            with r2c2:
                st.plotly_chart(chart_monthly_comparison(filtered), use_container_width=True)

            r3c1, r3c2 = st.columns(2)
            with r3c1:
                st.plotly_chart(chart_status_statistics(filtered), use_container_width=True)
            with r3c2:
                st.pyplot(chart_yearly_comparison_matplotlib(filtered))

# ---------------------------------------------------------------------------
# 8. REPORTS
# ---------------------------------------------------------------------------
elif page == "Reports":
    st.header("Search, Reports & CSV Exports")
    q = st.text_input("Search by Pet ID, Pet Name, or Owner Name")
    c1, c2 = st.columns(2)
    with c1:
        vax_filter = st.selectbox("Vaccine Filter", ["All"] + sorted(vax_df["vaccine_name"].unique().tolist()) if not vax_df.empty else ["All"])
    with c2:
        pet_report_id = st.selectbox("Individual Pet Report", pets_df["pet_id"].tolist() if not pets_df.empty else [])

    report_df = vax_df.copy()
    if q.strip():
        ql = q.strip().lower()
        report_df = report_df[
            report_df["pet_id"].str.lower().str.contains(ql)
            | report_df["pet_name"].str.lower().str.contains(ql)
            | report_df["owner_name"].str.lower().str.contains(ql)
        ]
    if vax_filter != "All":
        report_df = report_df[report_df["vaccine_name"] == vax_filter]

    st.dataframe(report_df, use_container_width=True, hide_index=True)

    d1, d2, d3 = st.columns(3)
    with d1:
        st.download_button(
            "Download Pets CSV",
            pets_df.to_csv(index=False).encode("utf-8"),
            file_name="pawsitive_care_pets.csv",
            mime="text/csv",
        )
    with d2:
        st.download_button(
            "Download Vaccinations CSV",
            report_df.to_csv(index=False).encode("utf-8"),
            file_name="pawsitive_care_vaccinations.csv",
            mime="text/csv",
        )
    with d3:
        summary_text = (
            f"Pawsitive Care Veterinary Clinic — Vaccination Summary ({today})\n"
            f"Total Pets: {len(pets_df)}\n"
            f"Total Records: {len(vax_df)}\n"
            f"Overdue: {int((vax_df['status'] == 'Overdue').sum()) if not vax_df.empty else 0}\n"
            f"Due Today: {int((vax_df['status'] == 'Due Today').sum()) if not vax_df.empty else 0}\n"
        )
        st.download_button(
            "Download Summary Report",
            summary_text.encode("utf-8"),
            file_name=f"pawsitive_care_summary_{today}.txt",
            mime="text/plain",
        )

    if pet_report_id:
        st.subheader(f"Individual Pet Vaccination Certificate — {pet_report_id}")
        pet_info = pets_df[pets_df["pet_id"] == pet_report_id].iloc[0]
        pet_vax = vax_df[vax_df["pet_id"] == pet_report_id]
        st.write(f"**{pet_info['pet_name']}** · {pet_info['species']} ({pet_info['breed']}) · Owner: {pet_info['owner_name']}")
        st.dataframe(
            pet_vax[["vaccine_name", "vaccination_date", "next_due_date", "status", "veterinarian_name", "notes"]],
            use_container_width=True,
            hide_index=True,
        )
