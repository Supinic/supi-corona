(async () => {
	process.env.MARIA_USER = "corona";
	process.env.MARIA_HOST = "localhost";
	process.env.MARIA_PASSWORD = "penis123";
	process.env.MARIA_CONNECTION_LIMIT = 5;

	const { CronJob } = require("cron");
	const got = require("got");
	const save = require("./save.js");

	await require("supi-core")("sb", {
		whitelist: [
			"objects/date",
			"objects/error",
			"singletons/query"
		]
	});

	sb.Corona = {
		parsers: {},
		cron: [],
		places: await sb.Query.getRecordset(rs => rs
			.select("ID", "Name", "Parent")
			.from("corona", "Place")
		)
	};
	
	const parsers = [
		["htmlTable", "html-table.js"],
		["github", "github.js"]
	];
	
	for (const [name, fileName] of parsers) {
		sb.Corona.parsers[name] = require("./parsers/" + fileName);
	}
		
	sb.Corona.cron.push({
		active: true,
		name: "global",
		expression: "0 40 */6 * * *",
		callback: async () => {
			const data = await sb.Corona.parsers.htmlTable({
				url: "https://www.worldometers.info/coronavirus/",
				selector: "#main_table_countries_today tbody tr:not([data-continent])",
				ignoredCountries: [
					"total",
					"total:",
					"world",
					"europe",
					"north america",
					"asia",
					"south america",
					"africa",
					"oceania",
					""
				],
				countryModificator: (country) => {
					if (country === "S. Korea") {
						country = "South Korea";
					}
					
					country = country.replace(/\./g, "");					
					return country;
				},
				fields: [
					"rank",
					"country", 
					"allCases", 
					"newCases", 
					"allDeaths", 
					"newDeaths",
					"allRecoveries",
					null, // unknown value, maybe attributes?
					"active", 
					"allCritical", 
					"cpm", 
					"dpm",
					"tests",
					"tpm"
				]
			});
			
			if (!data.success) {
				return;
			}
			
			await save(null, data.rows);
		}
	});
	
	sb.Corona.cron.push({
		active: true,
		name: "usa-states",
		expression: "0 40 */6 * * *",
		callback: async () => {
			const data = await sb.Corona.parsers.htmlTable({
				url: "https://www.worldometers.info/coronavirus/country/us/",
				selector: "#usa_table_countries_today tbody tr",
				ignoredCountries: [
					"total",
					"total:",
					"usa total"
				],
				fields: [
					"country", 
					"allCases",
					"newCases",
					"allDeaths", 
					"newDeaths"
				]
			});
			
			if (!data.success) {
				return;
			}
			
			await save("USA", data.rows);
		}
	});
	
	sb.Corona.cron.push({
		active: true,
		name: "italy-regions",
		expression: "0 40 */6 * * *",
		callback: async () => {
			const code = new sb.Date().format("Ymd");
			const data = await sb.Corona.parsers.github({
				type: "csv",
				owner: "pcm-dpc",
				repo: "COVID-19",
				path: `dati-regioni/dpc-covid19-ita-regioni-${code}.csv`,
				fields: [
					null, // date
					null, // "ITA"
					null, // Region code
					"country", // Region name
					null, // GPS Latitude
					null, // GPS Longitude
					null, // hospitalized
					"allCritical",
					null, // Total hospitalized
					null, // Home isolation
					"allCases", // total cases
					"newCases", // new cases
					"allRecoveries", // recovered
					"allDeaths", // new deaths
					null, // "super" total (all combined
					"tests"
				]
			});
			
			if (!data.success) {
				return;
			}
						
			await save("Italy", data.rows);			
		}
	});
		
	sb.Corona.cron.push({
		active: false,
		name: "romania-regions",
		expression: "0 40 */6 * * *",
		callback: async () => {
			const data = await sb.Corona.parsers.htmlTable({
				url: "https://covid19ro.org/",
				fields: [
					"country",
					"allCases",
					"allRecoveries",
					"quarantine",
					"isolation",
					"allDeaths"
				],
				selector: "table tr:not(:first-child)",
				ignoredCountries: ["total", "-"]
			});
			
			if (!data.success) {
				return;
			}
						
			await save("Romania", data.rows);			
		}
	});

	sb.Corona.cron.push({
		active: true,
		name: "vaccine-updater",
		expression: "0 30 3 * * *", // run daily at 03:30
		callback: async () => {
			const response = await got({
				url: "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations.json",
				responseType: "json"
			});

			if (response.statusCode !== 200) {
				console.warn("Could not parse vaccination data");
			}

			const today = new sb.Date().addDays(-1);
			const todayString = new sb.Date().addDays(-1).format("Y-m-d");
			const data = response.body;

			/*
			    "date": "2021-04-16",
		        "total_vaccinations": 61114,
		        "people_vaccinated": 33808,
		        "people_fully_vaccinated": 27306,
		        "daily_vaccinations_raw": 477,
		        "daily_vaccinations": 700,
		        "total_vaccinations_per_hundred": 92.99,
		        "people_vaccinated_per_hundred": 51.44,
		        "people_fully_vaccinated_per_hundred": 41.55,
		        "daily_vaccinations_per_million": 10651
			 */
			const promises = sb.Corona.places.filter(i => !i.Parent).map(async (place) => {
				const match = data.find(i => i.country === place.Name);
				if (!match) {
					return;
				}

				const item = match.data.find(i => i.date === todayString);
				if (!item) {
					return;
				}

				const row = await sb.Query.getRow("corona", "Vaccine_Status");
				row.setValues({
					Place: place.ID,
					Date: today,
					Total: item.total_vaccinations ?? null,
					New: item.daily_vaccinations ?? null,
					People: item.people_vaccinated ?? null,
					People_Fully: item.people_fully_vaccinated ?? null
				});

				await row.save({ ignore: true });
			});

			await Promise.all(promises);
		}
	});
		
	for (const row of sb.Corona.cron) {
		if (row.active === false) {
			continue;
		}

		row.job = new CronJob(row.expression, row.callback);
		row.job.start();
		
		console.log(`Cron job ${row.name} started`);
	}
})();
