# Pawsitive Care Veterinary Clinic — Vaccination Log & Trend Analysis System

A modular Python and Streamlit veterinary clinic management application powered by SQLite, Pandas, Plotly, and Matplotlib. Designed for clean clinic workflows, strict date and referential validation, dynamic vaccination due-status tracking, and interactive trend analytics.

## Project Folder Structure

```text
python_streamlit_app/
├── app.py               # Main Streamlit dashboard & 8-page navigation controller
├── database.py          # SQLite connection, schema, validation & CRUD operations
├── sample_data.py       # Demonstration dataset seeder (24 pets, 60+ vaccinations)
├── analytics.py         # Pandas aggregations & 6 interactive Plotly/Matplotlib charts
├── ui_components.py     # Clinical blue/teal theme CSS, KPI cards & alert components
├── requirements.txt     # Python package dependencies
├── README.md            # Documentation & VS Code setup guide
└── clinic.db            # Auto-generated SQLite database on first launch
```

## Module Explanations

- **`database.py`**: Initializes the `clinic.db` SQLite database with `PRAGMA foreign_keys = ON`, defines the `pets` and `vaccinations` tables, validates inputs (unique Pet IDs, phone/email format, non-future vaccination dates, next due dates >= vaccination dates), and computes dynamic due statuses (`Completed`, `Upcoming`, `Due Today`, `Overdue`).
- **`sample_data.py`**: Populates 24 demonstration pets (dogs, cats, and rabbits) and 64 vaccination records spanning multiple months and years on first startup if the database is empty. All demonstration entries are clearly labeled.
- **`analytics.py`**: Uses Pandas to deduplicate vaccination records by `vaccination_id` and generate 6 interactive charts (Monthly Trend Line, Top Vaccines Bar, Species Pie, Monthly Comparison, Status Breakdown, and Yearly Comparison) using Plotly and Matplotlib.
- **`ui_components.py`**: Applies a clean clinical light-mode stylesheet (Blue `#0284C7`, Teal `#0D9488`, White `#FFFFFF`), renders KPI statistic cards, color-coded status indicators, and in-app alert banners.
- **`app.py`**: Connects all modules into an 8-section sidebar application (`Dashboard`, `Register Pet`, `Pet Records`, `Add Vaccination`, `Vaccination History`, `Vaccination Tracker`, `Trend Analysis`, `Reports`).

## Running Locally in VS Code

1. Open the `python_streamlit_app` folder in **VS Code** (`File -> Open Folder...`).
2. Open the integrated terminal (`Ctrl + ~` or `Terminal -> New Terminal`).
3. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the Streamlit app:
   ```bash
   streamlit run app.py
   ```
6. Your browser will open at `http://localhost:8501`. Demonstration data is automatically seeded into `clinic.db` on the first run.
