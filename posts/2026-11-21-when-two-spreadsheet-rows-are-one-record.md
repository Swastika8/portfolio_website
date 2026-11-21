# When two spreadsheet rows are really one record

The smallest example I use to explain Enola ETL has three spreadsheet rows and two records. The extra row looks perfectly ordinary. You only spot it once ` CV-017 ` and `cv-017` go through the same cleanup rules.

Enola is a Python project I built to move Excel data into a database. The app previews the worksheet and checks its columns against the destination schema. I wanted to use my first post to think through a question that a column check leaves open. What makes two rows the same record? [Enola ETL source](https://github.com/Swastika8/Enola-ETL/blob/main/app.py)

## Start with what the ID means

Here are the fictional rows from the portfolio demo. The spaces inside the first ID are intentional.

```text
Excel row  Record ID   Team     Date
2          " CV-017 "  ops      2026/06/01
3          "cv-017"    OPS      2026-06-01
4          "CV-024"    support  2026/06/02
```

In this example, record IDs are case-insensitive, so trimming spaces and uppercasing the ID gives rows 2 and 3 the same key. The team codes agree after normalization, and the dates represent the same day once they’ve been parsed. If the source system treats case as meaningful, uppercasing would merge IDs that should stay separate. I’d write down that assumption before writing the cleanup code.

I’d also treat a text ID such as `0017` as text from the start. If Excel stores the number `17` and displays it as `0017` through cell formatting, reading it as a string later can’t recover those zeros. That’s a good reason to check the stored values and agree on an ID format with whoever supplies the sheet. [pandas documentation on reading Excel files](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)

## Keep the rows that disagree in view

Change row 3’s team from `OPS` to `Support` and the cleanup still gives it the key `CV-017`. Now there are two competing versions of the same record. A filter that keeps the first row would silently choose one. Switching the row order in Excel could change the result.

For a real import, I’d keep the original worksheet row number alongside every validated row in a staging table. This query finds IDs with more than one distinct team and date combination. Identical copies count as one version.

```sql
WITH versions AS (
  SELECT DISTINCT record_id, team_code, record_date
  FROM staged_records
)
SELECT record_id, COUNT(*) AS version_count
FROM versions
GROUP BY record_id
HAVING COUNT(*) > 1;
```

With the three rows above, the query returns nothing. After the team change, it returns `CV-017` with a count of `2`. I’d report the conflict as “Rows 2 and 3 disagree on the team for CV-017.” That gives someone a specific place to look in the sheet.

## Put the rule in the database too

If the import contract says there’s one destination row per normalized ID, a PostgreSQL primary key on that ID enforces uniqueness and prevents `NULL` keys. I’d keep that constraint even with the staging check. Another import process could write to the same table. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

I’d use `ON CONFLICT (record_id) DO NOTHING` only after deciding that skipping an existing key is the right behavior. A skipped insert tells me the key already exists. To distinguish a replay from a change, I’d compare the incoming values with the stored ones. [PostgreSQL INSERT reference](https://www.postgresql.org/docs/current/sql-insert.html)

My first tests for this import would fit in a single sheet. I’d include an exact repeat, two spellings of the same ID, and one pair that shares a key but disagrees on the team. Then I’d run the accepted batch twice and check that the destination rows and values agree after both runs. It’s a small test, and it tells me more than a green “import complete” banner.
