const cycle = ['High', 'Medium', 'Low'];

function fairPendingMissions(missions) {
  const groups = new Map(cycle.map((priority) => [priority, []]));
  for (const mission of missions) {
    if (mission.status !== 'Pending' || !mission.projectId) continue;
    (groups.get(mission.priority) || groups.get('Medium')).push(mission);
  }
  for (const group of groups.values()) group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const result = [];
  while ([...groups.values()].some((group) => group.length)) {
    for (const priority of cycle) {
      const mission = groups.get(priority).shift();
      if (mission) result.push(mission);
    }
  }
  return result;
}

module.exports = { fairPendingMissions };
