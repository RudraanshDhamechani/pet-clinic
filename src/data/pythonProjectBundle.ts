import JSZip from 'jszip';
import appPy from '../../python_streamlit_app/app.py?raw';
import databasePy from '../../python_streamlit_app/database.py?raw';
import sampleDataPy from '../../python_streamlit_app/sample_data.py?raw';
import analyticsPy from '../../python_streamlit_app/analytics.py?raw';
import uiComponentsPy from '../../python_streamlit_app/ui_components.py?raw';
import requirementsTxt from '../../python_streamlit_app/requirements.txt?raw';
import readmeMd from '../../python_streamlit_app/README.md?raw';

export interface PythonDeliverableFile {
  filename: string;
  role: string;
  description: string;
  content: string;
}

export const PYTHON_PROJECT_FILES: PythonDeliverableFile[] = [
  {
    filename: 'app.py',
    role: 'Main Streamlit Controller',
    description:
      'Coordinates the 8-page sidebar navigation, form submissions, in-app 7-day/overdue alerts, and CSV/summary download actions.',
    content: appPy,
  },
  {
    filename: 'database.py',
    role: 'SQLite Persistence & Validation',
    description:
      'Initializes pets and vaccinations tables with foreign keys, validates dates/phone/email/uniqueness, and dynamically computes vaccination statuses.',
    content: databasePy,
  },
  {
    filename: 'analytics.py',
    role: 'Pandas & Plotly/Matplotlib Engine',
    description:
      'Deduplicates vaccination records by vaccination_id and generates all 6 interactive trend charts across date ranges, species, and vaccines.',
    content: analyticsPy,
  },
  {
    filename: 'sample_data.py',
    role: 'Demonstration Dataset Seeder',
    description:
      'Seeds 24 realistic synthetic pets (dogs, cats, rabbits) and 64 multi-month/multi-year vaccination records on first launch.',
    content: sampleDataPy,
  },
  {
    filename: 'ui_components.py',
    role: 'Clinical Theme & Alert Components',
    description:
      'Defines the light clinical blue/teal stylesheet, KPI metric cards, accessible status labels, and alert panels.',
    content: uiComponentsPy,
  },
  {
    filename: 'requirements.txt',
    role: 'Dependency Manifest',
    description: 'Lists streamlit, pandas, plotly, and matplotlib versions required for local execution.',
    content: requirementsTxt,
  },
  {
    filename: 'README.md',
    role: 'Documentation & VS Code Guide',
    description: 'Explains folder structure, module architecture, and step-by-step VS Code terminal commands.',
    content: readmeMd,
  },
];

export async function downloadPythonProjectZip(): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('pawsitive_care_streamlit');
  if (!folder) return;

  for (const file of PYTHON_PROJECT_FILES) {
    folder.file(file.filename, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pawsitive_care_python_streamlit.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
