// Force a fixed host timezone for the whole suite (decision D1 / finding A11).
// Business-date formatters pin timeZone: 'UTC', so they must produce identical
// output regardless of the host; forcing UTC makes any future
// timezone regression visible in CI instead of hiding behind the host TZ.
process.env.TZ = "America/Bogota";
