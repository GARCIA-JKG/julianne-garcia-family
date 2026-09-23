export function MonthYearFields() {
  return (
    <label className="month-picker">
      Month / year
      <input
        name="monthYear"
        type="month"
        min="1000-01"
        max="2200-12"
        aria-label="Month and year of this memory"
      />
    </label>
  );
}
