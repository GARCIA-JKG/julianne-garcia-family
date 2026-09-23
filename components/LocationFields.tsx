export function LocationFields() {
  return (
    <div className="location-fields">
      <label>
        City / town
        <input
          name="locality"
          maxLength={120}
          placeholder="San Diego"
        />
      </label>

      <label>
        State / province / region
        <input
          name="region"
          maxLength={120}
          placeholder="California"
        />
      </label>

      <label>
        Country
        <input
          name="country"
          maxLength={120}
          placeholder="United States"
        />
      </label>
    </div>
  );
}
