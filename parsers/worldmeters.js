module.exports = async function parse (options = {}) {
	const got = require("got");
	const cheerio = require("cheerio");
	const baseURL = "https://www.worldometers.info/coronavirus";
	
	let html = null;
	try {
		html = await got({
			prefixUrl: baseURL,
			url: options.url,
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36 OPR/66.0.3515.72"
			}
		}).text();
	}
	catch (e) {
		return {
			success: false,
			cause: "fetch-fail",
			exception: e
		}
	}

	const $ = cheerio.load(html);
	const rows = Array.from($(options.selector));
	if (rows.length === 0) {
		return {
			success: false,
			cause: "no-rows"
		}
	}

	const total = {};
	for (const field of options.fields) {
		if (field === "country") {
			total.country = "Total";
		}
		else {
			total[field] = 0;
		}
	}

	const result = [];
	for (const row of rows) {
		const values = Array.from($(row).children()).map((node, ind) => {
			let value = null;
			const selector = $(node);

			if (ind !== 0) {
				value = Number(selector.text().replace(/,/g, "")) || 0;
			}
			else {
				const country = selector.text();
				value = {
					country,
					link: (node.firstChild?.tagName === "a")
						? `${baseURL}${node.firstChild.attribs.href}`
						: null
				};
			}

			return value;
		});
		
		if (values[0].country.toLowerCase().includes("total")) {
			continue;
		}

		const rowObject = {};
		for (let i = 0; i < options.fields.length; i++) {
			const field = options.fields[i];
			let value = values[i];

			if (field === "country") {
				let { country, link } = value;
				country = country.trim();

				// Fixing special cases
				if (country === "S. Korea") {
					country = "South Korea";
				}

				// Fixing "U.A.E." and "U.K."
				country = country.replace(/\./g, "");
				rowObject.country = country;
				rowObject.link = link;
			}
			else {
				total[field] += value;
				rowObject[field] = value;
			}
		}

		result.push(rowObject);
	}

	result.push({
		isTotal: true,
		...total
	});
	
	return {
		success: true,
		rows: result,
		selector: $
	};
};