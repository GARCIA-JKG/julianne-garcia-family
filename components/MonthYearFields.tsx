const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export function MonthYearFields() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="month-year-fields">
      <label>
        Month
        <select name="month" defaultValue="">
          <option value="">Unknown / unsure</option>
          {monthOptions.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
      </label>

      <label>
        Year
        <input
          name="year"
          type="number"
          inputMode="numeric"
          min={1000}
          max={currentYear}
          placeholder="1987"
        />
      </label>
    </div>
  );
}
