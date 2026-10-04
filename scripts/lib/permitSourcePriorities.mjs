/** Rank municipal-source research by residents not already served. No requests. */
export function permitSourcePriorities(communes, sources, {
  minimumPopulation = 50_000, excluded = [], candidates = [], research = [], revisit = [], day,
} = {}) {
  const excludedCodes = new Set(excluded);
  const validDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const history = new Map();
  for (const entry of research) {
    if (!/^(?:\d{5}|2[AB]\d{3})$/.test(entry.code ?? '') || !validDay(entry.checkedOn)
      || !Object.hasOwn(entry, 'revisitAfter')
      || (entry.revisitAfter !== null && (!validDay(entry.revisitAfter) || entry.revisitAfter < entry.checkedOn))) {
      throw new Error('Research entries require an INSEE code, checkedOn and a later revisitAfter date (or null for an explicit hold)');
    }
    if (day && entry.checkedOn > day) continue;
    const previous = history.get(entry.code);
    if (!previous || previous.checkedOn <= entry.checkedOn) history.set(entry.code, entry);
  }
  const revisited = new Set(revisit);
  const deferred = new Map([...history].filter(([code, entry]) => !revisited.has(code)
    && (entry.revisitAfter === null || !day || entry.revisitAfter > day)));
  // Geo API also lists overseas collectivities outside this population scope.
  const population = new Map(communes.filter((city) => !/^(975|977|978|98)/.test(city.code))
    .map((city) => [city.code, city]));
  const covered = new Set(sources.flatMap((source) => [source.insee, ...(source.communes ?? [])])
    .filter((code) => population.has(code)));
  const total = [...population.values()].reduce((sum, city) => sum + (city.population ?? 0), 0);
  const residents = [...covered].reduce((sum, code) => sum + (population.get(code).population ?? 0), 0);
  const uncovered = [...population.values()].filter((city) => !covered.has(city.code) && !excludedCodes.has(city.code));
  const town = ({ code, nom, population: count, codeEpci }) => ({ code, name: nom, population: count, epci: codeEpci ?? null,
    ...(history.has(code) ? { previousResearch: history.get(code) } : {}) });
  const rank = (a, b) => b.population - a.population || a.code.localeCompare(b.code);
  const towns = uncovered.filter((city) => !deferred.has(city.code) && (city.population ?? 0) >= minimumPopulation)
    .sort(rank).map(town);
  const deferredTowns = uncovered.filter((city) => deferred.has(city.code) && (city.population ?? 0) >= minimumPopulation)
    .sort((a, b) => b.population - a.population || a.code.localeCompare(b.code))
    .map(town);
  const groups = new Map();
  for (const city of uncovered) {
    if (!city.codeEpci || deferred.has(city.code)) continue;
    const group = groups.get(city.codeEpci) ?? { code: city.codeEpci, population: 0, municipalities: [] };
    group.population += city.population ?? 0;
    group.municipalities.push({ code: city.code, name: city.nom, population: city.population ?? 0,
      ...(history.has(city.code) ? { previousResearch: history.get(city.code) } : {}) });
    groups.set(city.codeEpci, group);
  }
  const intermunicipalities = [...groups.values()].filter((group) => group.population >= minimumPopulation)
    .sort((a, b) => b.population - a.population || a.code.localeCompare(b.code));
  for (const group of intermunicipalities) group.municipalities.sort((a, b) => b.population - a.population || a.code.localeCompare(b.code));
  const cutoff = day ? new Date(`${day}T00:00:00Z`) : null;
  if (cutoff) cutoff.setUTCMonth(cutoff.getUTCMonth() - 3, 1);
  const since = cutoff?.toISOString().slice(0, 10);
  const rankedCandidates = candidates.map((candidate) => {
    const codes = [...new Set(candidate.communes ?? [])];
    const newCodes = codes.filter((code) => population.has(code) && !covered.has(code) && !excludedCodes.has(code));
    const gain = newCodes.reduce((sum, code) => sum + (population.get(code).population ?? 0), 0);
    const fresh = Boolean(day && candidate.verified === true
      && validDay(candidate.latestPublication)
      && candidate.latestPublication >= since && candidate.latestPublication <= day);
    return { key: candidate.key, url: candidate.url, latestPublication: candidate.latestPublication ?? null,
      verifiedFresh: fresh, potentialPopulation: gain, verifiedPopulation: fresh ? gain : 0, newMunicipalities: newCodes };
  }).sort((a, b) => b.verifiedPopulation - a.verifiedPopulation || b.potentialPopulation - a.potentialPopulation || a.key.localeCompare(b.key));
  // Candidate gains overlap: report the union, never their sum.
  const verifiedCodes = new Set(rankedCandidates.filter((candidate) => candidate.verifiedFresh).flatMap((candidate) => candidate.newMunicipalities));
  return { day: day ?? null, minimumPopulation, excluded: [...excludedCodes],
    coverage: { municipalities: covered.size, population: residents, denominator: total, percentage: total ? residents * 100 / total : 0 },
    verifiedAdditionalPopulation: [...verifiedCodes].reduce((sum, code) => sum + (population.get(code).population ?? 0), 0),
    towns, deferredTowns, intermunicipalities, candidates: rankedCandidates };
}
