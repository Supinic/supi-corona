module.exports = async function save (region, rows) {
	if (!sb.Query) {
		throw new Error("No database connector");
	}

	const processedPlaces = [];
	const now = new sb.Date().discardTimeUnits("s", "ms");
	const batch = await sb.Query.getBatch(
		"corona",
		"Status",
		[
			"Date",
			"Place",
			"Tests",

			"New_Cases",
			"New_Criticals",
			"New_Deaths",
			"New_Recoveries",

			"All_Cases",
			"All_Criticals",
			"All_Deaths",
			"All_Recoveries"
		]
	);

	for (const row of rows) {
		const { 
			country,
			isTotal,			
			tests,
		
			newCases,
			newDeaths,
			newRecoveries,
			newCriticals,
			
			allCases,
			allDeaths,
			allRecoveries,
			allCriticals,
		} = row;
		
		if (isTotal) {
			continue;
		}			
		
		let targetCountry = sb.Corona.places.find(i => i.Name === country && i.Parent === region);
		if (!targetCountry) {
			console.log("New country detected!", { country, region });
			
			const placeRow = await sb.Query.getRow("corona", "Place");
			placeRow.setValues({
				Name: country,
				Parent: region ?? null
			});
			
			await placeRow.save();			
			targetCountry = {
				ID: placeRow.values.ID,
				Name: country,
				Parent: region,
			};
			
			sb.Corona.places.push(targetCountry);
		}

		processedPlaces.push(targetCountry.ID);

		batch.add({
			Date: now,
			Place: targetCountry.ID,
			Tests: tests ?? null,

			New_Cases: newCases ?? null,
			New_Criticals: newCriticals ?? null,
			New_Deaths: newDeaths ?? null,
			New_Recoveries: newRecoveries ?? null,

			All_Cases: allCases ?? 0,
			All_Criticals: allCriticals ?? null,
			All_Deaths: allDeaths ?? null,
			All_Recoveries: allRecoveries ?? null
		});
	}

	await batch.insert();
	batch.destroy();

	await sb.Query.getRecordUpdater(rs => rs
		.update("corona", "Status")
		.set("Latest", false)
		.where("Place IN %n+", processedPlaces)
		.where("Latest = %b", true)
		.where("Date < %dt", now)
	);
}