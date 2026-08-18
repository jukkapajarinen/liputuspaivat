/**
 * Suomen liputuspäivät — renders the Finnish flag-flying-day calendar for
 * the current year and provides a .ics export covering the current year
 * plus any number of years ahead.
 *
 * Flag day names, categories, and date rules are defined once in
 * FLAG_DAYS and shared by both the calendar renderer and the .ics export.
 */

/**
 * Computes the ISO 8601 week number for a given date.
 * @param {Date} date
 * @returns {number} ISO week number (1–53)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Finds the n-th Sunday of a given month.
 * @param {number} year
 * @param {number} month - Zero-based month (0 = January).
 * @param {number} n - Which Sunday to return (1 = first, 2 = second, ...).
 * @returns {Date}
 */
function nthSundayOfMonth(year, month, n) {
  const d = new Date(year, month, 1);
  let count = 0;
  while (true) {
    if (d.getDay() === 0) count++;
    if (count === n) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
}

/**
 * Finds the last Saturday of a given month.
 * @param {number} year
 * @param {number} month - Zero-based month (0 = January).
 * @returns {Date}
 */
function lastSaturdayOfMonth(year, month) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
  return new Date(d);
}

/**
 * Finds Midsummer Day: the first Saturday between June 20 and 26.
 * @param {number} year
 * @returns {Date}
 */
function midsummerSaturday(year) {
  for (let day = 20; day <= 26; day++) {
    const date = new Date(year, 5, day);
    if (date.getDay() === 6) return date;
  }
}

/**
 * Alternates the background color per month so months are easy to tell apart.
 * @param {number} month - Zero-based month (0 = January).
 * @returns {string} Tailwind background class.
 */
function monthBgClass(month) {
  return month % 2 === 0 ? "bg-white" : "bg-gray-200";
}

/**
 * Builds a single day cell for the calendar, including flag-day and
 * today highlighting.
 * @param {Date} date
 * @param {number} year - The year the calendar displays.
 * @param {Date} today - Today's date with the time zeroed out.
 * @param {string[]} monthNames - Finnish month-name prefixes, indexed 0–11.
 * @param {Object<string, FlagDay[]>} flagsByDate - Flag days keyed by `toDateString()`.
 * @returns {HTMLTableCellElement}
 */
function buildDayCell(date, year, today, monthNames, flagsByDate) {
  const td = document.createElement("td");
  td.className = "border border-gray-300 align-top p-2 transition duration-150 hover:bg-blue-50";

  // Padding days from the previous/next year are left blank.
  if (date.getFullYear() !== year) {
    td.classList.add("bg-gray-100");
    return td;
  }

  let dayText = date.getDate();
  if (dayText === 1) dayText += `.${monthNames[date.getMonth()]}`;
  td.innerHTML = `<div class="day font-semibold text-right">${dayText}</div>`;

  td.classList.add(monthBgClass(date.getMonth()));

  if (date < today) td.classList.add("text-gray-400", "line-through");

  const dayFlags = flagsByDate[date.toDateString()];
  if (dayFlags) {
    // Official flag days get a stronger blue, established ones a lighter indigo.
    const isOfficial = dayFlags.some(f => f.category === "virallinen");
    td.classList.remove("bg-white", "bg-gray-200");
    td.classList.add(...(isOfficial
      ? ["bg-blue-200", "border-l-4", "border-blue-700"]
      : ["bg-indigo-100", "border-l-4", "border-indigo-500"]));
    td.classList.add("cursor-help");

    td.title = dayFlags.map(f => `${f.name} (${f.rule})`).join("\n");
    td.innerHTML += `<div class="text-blue-900 font-semibold mt-2 text-xs leading-snug">${dayFlags.map(f => f.name).join(", ")}</div>`;
  }

  if (date.getTime() === today.getTime()) {
    td.classList.remove(
      "bg-white", "bg-gray-200", "bg-blue-200", "bg-indigo-100",
      "border-l-4", "border-blue-700", "border-indigo-500"
    );
    td.classList.add("bg-green-200", "ring-4", "ring-green-500", "ring-inset", "relative", "z-10");

    if (dayFlags) {
      td.querySelector(".day").textContent += " 🇫🇮";
    }
  }

  return td;
}

/**
 * Builds the full calendar table (header row + one row per week of the year)
 * and appends it to the `#calendar` element. Marks the row containing today's
 * date with id="today-row".
 * @param {number} year - The year to render.
 * @param {Date} today - Today's date with the time zeroed out.
 * @param {Object<string, FlagDay[]>} flagsByDate - Flag days keyed by `toDateString()`.
 * @param {string[]} monthNames - Finnish month-name prefixes, indexed 0–11.
 */
function buildCalendarTable(year, today, flagsByDate, monthNames) {
  const calendar = document.getElementById("calendar");

  const thead = document.createElement("thead");
  thead.className = "bg-gray-100";

  const headRow = document.createElement("tr");
  headRow.className = "h-10";
  ["Viikko", "Ma", "Ti", "Ke", "To", "Pe", "La", "Su"].forEach((day, i) => {
    const th = document.createElement("th");
    th.className = `border border-blue-900 ${i === 0 ? "w-14" : ""} bg-blue-800 text-white font-semibold uppercase tracking-wide text-xs`;
    th.textContent = day;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  calendar.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.id = "calendar-body";
  calendar.appendChild(tbody);

  // Start from the Monday on or before Jan 1, so weeks always begin on Monday.
  let date = new Date(year, 0, 1);
  while (date.getDay() !== 1) date.setDate(date.getDate() - 1);

  while (date.getFullYear() <= year) {
    const tr = document.createElement("tr");
    tr.className = "h-24";

    const weekTd = document.createElement("td");
    weekTd.textContent = getWeekNumber(date);
    weekTd.className = "border border-gray-300 text-gray-700 bg-gray-100 font-semibold text-xs";
    tr.appendChild(weekTd);

    for (let i = 0; i < 7; i++) {
      const isToday = date.getFullYear() === year && date.getTime() === today.getTime();
      tr.appendChild(buildDayCell(date, year, today, monthNames, flagsByDate));
      if (isToday) tr.id = "today-row";
      date.setDate(date.getDate() + 1);
    }

    tbody.appendChild(tr);
  }
}

/**
 * Generates an .ics file with all flag days from `year` through `yearsAhead`
 * years ahead, and triggers a browser download for it.
 * @param {number} yearsAhead - How many additional years to include (0 = current year only).
 * @param {number} year - The starting year.
 * @param {FlagDay[]} flagDays - The flag days to include.
 */
function exportICS(yearsAhead, year, flagDays) {
  const startYear = year;
  const endYear = year + yearsAhead;

  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  let ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Jukka Pajarinen//Suomen liputuspäivät//FI
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

  const addEvent = (date, name) => {
    const end = new Date(date);
    end.setDate(end.getDate() + 1); // all-day events need DTEND set to the following day

    ics +=
`BEGIN:VEVENT
UID:${name.replace(/\s+/g, "-").toLowerCase()}-${ymd(date)}@liputuspv
DTSTART;VALUE=DATE:${ymd(date)}
DTEND;VALUE=DATE:${ymd(end)}
SUMMARY:${name} 🇫🇮
TRANSP:TRANSPARENT
END:VEVENT
`;
  };

  for (let y = startYear; y <= endYear; y++) {
    flagDays.forEach(flag => addEvent(flag.date(y), flag.name));
  }

  ics += "END:VCALENDAR";

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download =
    yearsAhead === 0
      ? `suomen-liputuspaivat-${startYear}.ics`
      : `suomen-liputuspaivat-${startYear}-${endYear}.ics`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Entry point. Owns all of the page's setup data (FLAG_DAYS, monthNames,
 * today, year, flagsByDate) and passes it into the other functions as
 * parameters, rather than sharing it through module-level variables.
 */
function main() {
  /**
   * Single source of truth for both the on-page calendar and the .ics
   * export, so each flag day's name and date rule only needs to be
   * defined once.
   * @typedef {Object} FlagDay
   * @property {"virallinen"|"vakiintunut"} category - Official vs. established flag day.
   * @property {string} name
   * @property {string} rule - Human-readable description of the date rule, shown in tooltips.
   * @property {(year: number) => Date} date - Resolves this flag day's date for a given year.
   * @type {FlagDay[]}
   */
  const FLAG_DAYS = [
    // Official flag days
    { category: "virallinen", name: "Kalevalan päivä", rule: "28.2.", date: y => new Date(y, 1, 28) },
    { category: "virallinen", name: "Vappu", rule: "1.5.", date: y => new Date(y, 4, 1) },
    { category: "virallinen", name: "Puolustusvoimain lippujuhlan päivä", rule: "4.6.", date: y => new Date(y, 5, 4) },
    { category: "virallinen", name: "Juhannuspäivä – Suomen lipun päivä", rule: "Kesäkuun 20.–26. lauantai", date: midsummerSaturday },
    { category: "virallinen", name: "Isänpäivä", rule: "Marraskuun toinen sunnuntai", date: y => nthSundayOfMonth(y, 10, 2) },
    { category: "virallinen", name: "Äitienpäivä", rule: "Toukokuun toinen sunnuntai", date: y => nthSundayOfMonth(y, 4, 2) },
    { category: "virallinen", name: "Itsenäisyyspäivä", rule: "6.12.", date: y => new Date(y, 11, 6) },

    // Established flag days
    { category: "vakiintunut", name: "J. L. Runebergin päivä", rule: "5.2.", date: y => new Date(y, 1, 5) },
    { category: "vakiintunut", name: "Minna Canthin päivä", rule: "19.3.", date: y => new Date(y, 2, 19) },
    { category: "vakiintunut", name: "Mikael Agricolan päivä", rule: "9.4.", date: y => new Date(y, 3, 9) },
    { category: "vakiintunut", name: "Kansallinen veteraanipäivä", rule: "27.4.", date: y => new Date(y, 3, 27) },
    { category: "vakiintunut", name: "Eurooppa-päivä", rule: "9.5.", date: y => new Date(y, 4, 9) },
    { category: "vakiintunut", name: "J. V. Snellmanin päivä", rule: "12.5.", date: y => new Date(y, 4, 12) },
    { category: "vakiintunut", name: "Kaatuneitten muistopäivä", rule: "Toukokuun kolmas sunnuntai", date: y => nthSundayOfMonth(y, 4, 3) },
    { category: "vakiintunut", name: "Eino Leinon päivä", rule: "6.7.", date: y => new Date(y, 6, 6) },
    { category: "vakiintunut", name: "Suomen luonnon päivä", rule: "Elokuun viimeinen lauantai", date: y => lastSaturdayOfMonth(y, 7) },
    { category: "vakiintunut", name: "Miina Sillanpään päivä", rule: "1.10.", date: y => new Date(y, 9, 1) },
    { category: "vakiintunut", name: "Aleksis Kiven päivä", rule: "10.10.", date: y => new Date(y, 9, 10) },
    { category: "vakiintunut", name: "YK:n päivä", rule: "24.10.", date: y => new Date(y, 9, 24) },
    { category: "vakiintunut", name: "Ruotsalaisuuden päivä", rule: "6.11.", date: y => new Date(y, 10, 6) },
    { category: "vakiintunut", name: "Lapsen oikeuksien päivä", rule: "20.11.", date: y => new Date(y, 10, 20) },
    { category: "vakiintunut", name: "Jean Sibeliuksen päivä", rule: "8.12.", date: y => new Date(y, 11, 8) },
  ];

  const monthNames = ["tammi", "helmi", "maalis", "huhti", "touko", "kesä",
                       "heinä", "elo", "syys", "loka", "marras", "joulu"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = today.getFullYear();

  document.getElementById("year").textContent = year;
  document.getElementById("year-btn").textContent = year;
  document.title += ` ${year}`;

  // Flag days for the current year, keyed by `toDateString()` so multiple
  // flag days landing on the same date can be grouped into a single cell.
  const flagsByDate = {};
  FLAG_DAYS.forEach(flag => {
    const key = flag.date(year).toDateString();
    (flagsByDate[key] ??= []).push(flag);
  });

  buildCalendarTable(year, today, flagsByDate, monthNames);

  const todayRow = document.getElementById("today-row");
  if (todayRow) {
    requestAnimationFrame(() => {
      todayRow.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // The download buttons call downloadICS(yearsAhead) directly from inline
  // onclick handlers in the HTML, so it's exposed on window here, bound to
  // this year's data.
  window.downloadICS = yearsAhead => exportICS(yearsAhead, year, FLAG_DAYS);
}

main();
