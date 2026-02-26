# INKOMMANDE MVP (Desktop Java Swing)

## What this does
- First launch asks for base directory, then creates `INKOMMANDE/` inside it.
- Saves selected base path in `~/.inkommande-mvp/config.properties`.
- Drag & drop one or many files onto app window (files only).
- Copies files into `INKOMMANDE`, auto-renames duplicates (`name (1).ext`, etc).
- Stores file record in local SQLite DB (`~/.inkommande-mvp/inkommande.db`) with status `NeedsMetadata`.
- Opens metadata form after import and updates status to `Ready` when saved.
- Dashboard table supports sorting, filtering/search, pagination, and open-file action.
- Search autocomplete from DB values (title, filename, category, tags).
- Indexed DB fields for responsive search.

## Run
```bash
cd InkommandeMVP
mvn compile
mvn exec:java
```

## IntelliJ
1. Open IntelliJ IDEA
2. Open folder: `InkommandeMVP`
3. Let IntelliJ import as Maven project
4. Run `com.plupp.inkommande.Main`
