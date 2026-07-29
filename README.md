# מאגר מתקני אימון ארצי

מפת מתקני אימון (Leaflet) עם סיידבר, פילטרים, חיפוש ופופאפ פרטים.

## הרצה

```bash
npm install
npm run dev
```

בנייה לפרודקשן:

```bash
npm run build
npm run preview
```

## משתמשים

בפתיחה בוחרים תפקיד:

- **אורח** — צפייה במפה, חיפוש ופילטרים בלבד
- **מנהל** — הוספה / עריכה / מחיקה של מתקנים (סיסמה ברירת מחדל: `123`)

סיסמת המנהל מוגדרת ב־[`src/config/auth.js`](src/config/auth.js).

שינויי מנהל נשמרים ב־`localStorage` בדפדפן.

## מבנה

- `src/` — קוד האפליקציה (מודולי ES)
- `public/data/data.geojson` — נתוני המתקנים
- `public/assets/` — לוגואים, אייקונים, תמונות, פונט
- `public/Israel/` — אריחי מפה אופליין (TMS)

## מפת אריחים (אופליין בלבד)

המפה **לא תלויה באינטרנט**.

- אריחים מקומיים: `public/Israel/{z}/{x}/{y}.png` (TMS)
- Leaflet מגיע מחבילת npm ונארז בבנייה — בלי CDN
- אין שימוש ב־OpenStreetMap או שרתי אריחים חיצוניים

הגדרה: [`src/config/tileConfig.js`](src/config/tileConfig.js).

## סכמת נתונים

כל Feature ב־GeoJSON כולל:

- `nameOfFacility`, `unitOwningTheFacility`, `locationOfFacility`, `areaInTheCountry`
- `TypesOfFacilities[]` עם `typeOfFacility`, `specificTypeOfFacility`, `trainingOptions`, `trainingFrame`, `imgArr`, `comments`
- `geometry` מסוג Point `[lng, lat]`

סוגי מתקן ואזורים מוגדרים במקום אחד: [`src/config/constants.js`](src/config/constants.js).
