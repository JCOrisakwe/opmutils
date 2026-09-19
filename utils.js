function getDatesInRange(from, to) {
  const dates = [];
  const cur = new Date(from);
  const end = new Date(to);

  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return dates;
}

function mergeCSV(csvStrArr) {
  const mergedChunks = [];

  for (const str of csvStrArr) {
    if (mergedChunks.length === 0) {
      mergedChunks.push(str.trim());
      continue;
    }
    const lines = str.trim().split(/\r?\n/);
    mergedChunks.push(lines.slice(1).join("\n"));
  }

  return mergedChunks.join("\n");
}

module.exports = {
  getDatesInRange,
  mergeCSV,
};
