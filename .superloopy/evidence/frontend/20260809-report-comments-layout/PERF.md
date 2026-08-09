# Performance notes

- No framework or runtime dependency was added.
- The visitor counter is a small deferred script and makes one POST request; a failed write falls back to a read-only GET.
- Visitor writes are deduplicated by browser ID, site ID, and Seoul calendar date.
- Comment lists remain capped at 50 rows per report.
- Wide report content is wrapped only when needed; static report markup and media are otherwise unchanged.
- The deployed Worker upload is 19.02 KiB before compression and 3.65 KiB compressed.
