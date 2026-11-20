const sampleTable = document.querySelector('#sample-table');
const sampleBody = sampleTable.tBodies[0];
const sampleAction = document.querySelector('#sample-action');
const sampleStatus = document.querySelector('#sample-status');
const worksheetRows = [...sampleBody.rows].map((row) => row.cloneNode(true));
let showingOutput = false;

sampleAction.hidden = false;
sampleAction.addEventListener('click', () => {
  if (showingOutput) {
    sampleBody.replaceChildren(...worksheetRows.map((row) => row.cloneNode(true)));
    sampleTable.caption.textContent = 'Sample worksheet input';
    sampleAction.textContent = 'Normalize rows';
    sampleStatus.textContent = `${worksheetRows.length} rows in the source worksheet.`;
    showingOutput = false;
    return;
  }

  const records = new Map();

  for (const row of worksheetRows) {
    const [rawId, rawTeam, rawDate] = [...row.cells].map((cell) => cell.textContent.trim());
    const id = rawId.toUpperCase();

    if (!records.has(id)) {
      const team = rawTeam.charAt(0).toUpperCase() + rawTeam.slice(1).toLowerCase();
      const date = rawDate.replaceAll('/', '-');
      records.set(id, [id, team, date]);
    }
  }

  sampleBody.replaceChildren();
  for (const fields of records.values()) {
    const row = sampleBody.insertRow();
    for (const field of fields) {
      row.insertCell().textContent = field;
    }
  }

  const duplicates = worksheetRows.length - records.size;
  sampleTable.caption.textContent = 'Sample PostgreSQL output';
  sampleAction.textContent = 'Reset sample';
  sampleStatus.textContent = `${records.size} normalized records. ${duplicates} duplicate row removed.`;
  showingOutput = true;
});
