(async () => {
	process.env.MARIA_USER = "corona";
	process.env.MARIA_HOST = "localhost";
	process.env.MARIA_PASSWORD = "penis123";
	process.env.MARIA_CONNECTION_LIMIT = 5;

	const { CronJob } = require("cron");
	const got = require("got");
	const cheerio = require("cheerio");
	const save = require("./save.js"); // lolol
	
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
		name: "global",
		expression: "0 */30 * * * *",
		callback: async () => {
			const data = await sb.Corona.parsers.htmlTable({
				url: "https://www.worldometers.info/coronavirus/",
				selector: "#main_table_countries_today tbody tr",
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
					"country", 
					"allCases", 
					"newCases", 
					"allDeaths", 
					"newDeaths",
					"allRecoveries", 
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
		name: "usa-states",
		expression: "0 */30 * * * *",
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
		name: "italy-regions",
		expression: "0 30 19 * * *",
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
		name: "romania-regions",
		expression: "0 0 * * * *",
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
		
	for (const row of sb.Corona.cron) {
		row.job = new CronJob(row.expression, row.callback);
		row.job.start();
		
		console.log(`Cron job ${row.name} started`);
	}
})();