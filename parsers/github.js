module.exports = async function parse (options = {}) {	
	const got = require("got");	
	const csvParser = require("neat-csv");
	const { fields, region, owner, repo, path } = options;
	
	const { content } = await got({
		url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
	}).json();
	
	if (options.type === "csv") {		
		const rawData = await csvParser(Buffer.from(content, "base64").toString());
		
		const keys = Object.keys(rawData[0]);
		const data = rawData.map(row => {
			const obj = { region };
			for (let i = 0; i < fields.length; i++) {
				if (fields[i] === null) {
					continue;
				}
				else if (fields[i] === "country") {
					obj[fields[i]] = row[keys[i]]
				}
				else {
					obj[fields[i]] = Number(row[keys[i]]);
				}
			}
				
			return obj;
		});
				
		return {
			success: true,
			rows: data
		};
	}
	else {
		throw new Error(`Type ${options.type} is not supported`);
	}
};