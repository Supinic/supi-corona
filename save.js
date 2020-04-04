module.exports = async function save (region, rows) {
	if (!sb.Query) {
		throw new Error("No database connector");
	}
	
	const processedPlaces = [];
	const now = new sb.Date().discardTimeUnits("s", "ms");
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
		const statusRow = await sb.Query.getRow("corona", "Status");
		statusRow.setValues({
			Date: now,
			Place: targetCountry.ID,
			Tests: tests ?? null,
			
			New_Cases: newCases ?? null,
			New_Criticals: newCriticals ?? null,
			New_Deaths: newDeaths ?? null,
			New_Recoveries: newRecoveries ?? null,
			
			All_Cases: allCases ?? 0,
			All_Criticals: allCriticals ?? 0,
			All_Deaths: allDeaths ?? 0,
			All_Recoveries: allRecoveries ?? 0
		});
		
		await statusRow.save();
	}	

	const updateResult = await sb.Query.getRecordUpdater(rs => rs
		.update("corona", "Status")
		.set("Latest", false)
		.where("Place IN %n+", processedPlaces)
		.where("Latest = %b", true)
		.where("Date < %dt", now)
	);
}